import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import {
  mettreAJourJoueur,
  VOLATILITE_INITIALE,
  RD_MAX,
  GLICKO_BASE,
  type EtatGlicko,
  type ResultatMatch,
} from "@/lib/glicko2";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const NIVEAUX_COMPTES = ["code_tournoi", "historique"] as const;

async function compterVictoiresRecentes(
  supabase: SupabaseServer,
  gagnantId: string,
  perdantId: string,
  avant: Date,
): Promise<number> {
  const depuis = new Date(avant.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("match_verdicts")
    .select("match_id, cree_le, match:matches(statut, match_participants(profile_id))")
    .eq("gagnant_id", gagnantId)
    .eq("est_definitif", true)
    .in("niveau", NIVEAUX_COMPTES)
    .gte("cree_le", depuis)
    .lt("cree_le", avant.toISOString());

  return (data ?? []).filter((v) => {
    const m = v.match;
    if (!m || m.statut === "forfait") return false;
    return m.match_participants.some((p) => p.profile_id === perdantId);
  }).length;
}

/**
 * Clôture un tournoi : calcule et journalise la mise à jour Glicko-2 de
 * chaque participant (docs/moteur-resultats.md §4). Idempotent — se
 * relancer sur un tournoi déjà clôturé ne recrédite jamais personne
 * (garde vérifiée à la fois ici et, de façon définitive, dans la
 * fonction SQL `cloturer_rating_joueur`).
 *
 * N'exige pas d'autorisation propre : appelée en interne juste après que
 * l'organisateur a enregistré le dernier verdict du tournoi (voir
 * organisation-actions.ts), dans une session déjà vérifiée.
 */
export async function cloturerTournoi(tournamentId: string): Promise<void> {
  const supabase = await createClient();

  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("id, game_id, season_id, statut, compte_pour_classement")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournoi || tournoi.statut === "termine") {
    return;
  }

  await supabase.from("tournaments").update({ statut: "termine" }).eq("id", tournamentId);

  // Tournoi non classé, ou aucune saison active au moment où il a eu lieu :
  // pas de ligne à écrire dans ratings/rating_events (season_id y est NOT
  // NULL). Le tournoi reste clôturé, simplement sans effet sur le classement.
  if (!tournoi.compte_pour_classement || !tournoi.season_id) {
    return;
  }

  const { data: matchsData } = await supabase
    .from("matches")
    .select(
      "id, statut, match_participants(profile_id), verdict:match_verdicts(niveau, gagnant_id, cree_le, est_definitif)",
    )
    .eq("tournament_id", tournamentId);

  const matchs = matchsData ?? [];

  const joueursDuBracket = new Set<string>();
  for (const m of matchs) {
    for (const p of m.match_participants) joueursDuBracket.add(p.profile_id);
  }
  if (joueursDuBracket.size === 0) {
    return;
  }

  // Ne retenir que les verdicts définitifs de niveau 2/3, hors forfait —
  // un verdict manuel (niveau 1) ou un match forfait ne compte jamais.
  interface Candidat {
    gagnantId: string;
    perdantId: string;
    creeLe: Date;
  }
  const candidats: Candidat[] = [];
  for (const m of matchs) {
    if (m.statut === "forfait") continue;
    const verdict = (m.verdict ?? []).find(
      (v) => v.est_definitif && (NIVEAUX_COMPTES as readonly string[]).includes(v.niveau),
    );
    if (!verdict || !verdict.gagnant_id) continue;
    const perdant = m.match_participants.find((p) => p.profile_id !== verdict.gagnant_id);
    if (!perdant) continue;
    candidats.push({
      gagnantId: verdict.gagnant_id,
      perdantId: perdant.profile_id,
      creeLe: new Date(verdict.cree_le),
    });
  }
  candidats.sort((a, b) => a.creeLe.getTime() - b.creeLe.getTime());

  // Plafond anti-abus : au-delà de 3 victoires contre le même adversaire
  // sur 24h (toutes compétitions confondues), les suivantes sont ignorées.
  const candidatsRetenus: Candidat[] = [];
  for (const c of candidats) {
    const nbPrealables = await compterVictoiresRecentes(
      supabase,
      c.gagnantId,
      c.perdantId,
      c.creeLe,
    );
    if (nbPrealables < 3) {
      candidatsRetenus.push(c);
    }
  }

  // État de départ figé de chaque joueur du bracket — jamais l'état
  // courant, qui pourrait déjà refléter un autre match traité juste avant.
  const { data: ratingsData } = await supabase
    .from("ratings")
    .select("profile_id, rating, rd, volatilite, matchs_joues")
    .eq("game_id", tournoi.game_id)
    .eq("season_id", tournoi.season_id)
    .in("profile_id", Array.from(joueursDuBracket));

  const etatDepart = new Map<string, EtatGlicko>();
  for (const id of joueursDuBracket) {
    const existant = (ratingsData ?? []).find((r) => r.profile_id === id);
    etatDepart.set(
      id,
      existant
        ? { rating: existant.rating, rd: existant.rd, volatilite: existant.volatilite }
        : { rating: GLICKO_BASE, rd: RD_MAX, volatilite: VOLATILITE_INITIALE },
    );
  }

  const resultatsParJoueur = new Map<string, ResultatMatch[]>();
  for (const id of joueursDuBracket) resultatsParJoueur.set(id, []);
  for (const c of candidatsRetenus) {
    const etatGagnant = etatDepart.get(c.gagnantId);
    const etatPerdant = etatDepart.get(c.perdantId);
    if (!etatGagnant || !etatPerdant) continue;
    resultatsParJoueur.get(c.gagnantId)!.push({ adversaire: etatPerdant, score: 1 });
    resultatsParJoueur.get(c.perdantId)!.push({ adversaire: etatGagnant, score: 0 });
  }

  const admin = creerClientAdmin();

  for (const profileId of joueursDuBracket) {
    const avant = etatDepart.get(profileId)!;
    const resultats = resultatsParJoueur.get(profileId) ?? [];
    const apres = mettreAJourJoueur(avant, resultats);

    if (!admin) {
      // Pas encore de SUPABASE_SERVICE_ROLE_KEY configurée : le tournoi
      // est bien clôturé, mais l'écriture du classement échoue proprement
      // plutôt que de contourner la règle CLAUDE.md §6.1 (aucune écriture
      // client sur ratings/rating_events).
      continue;
    }

    await admin.rpc("cloturer_rating_joueur", {
      p_profile_id: profileId,
      p_game_id: tournoi.game_id,
      p_season_id: tournoi.season_id,
      p_tournament_id: tournamentId,
      p_rating_avant: avant.rating,
      p_rd_avant: avant.rd,
      p_volatilite_avant: avant.volatilite,
      p_rating_apres: apres.rating,
      p_rd_apres: apres.rd,
      p_volatilite_apres: apres.volatilite,
      p_matchs_comptes: resultats.length,
      p_motif: "tournoi",
    });
  }
}
