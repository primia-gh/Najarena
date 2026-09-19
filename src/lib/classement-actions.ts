import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import {
  mettreAJourJoueur,
  softResetSaison,
  VOLATILITE_INITIALE,
  RD_MAX,
  GLICKO_BASE,
  type EtatGlicko,
  type ResultatMatch,
} from "@/lib/glicko2";

const SEUIL_INACTIVITE_JOURS = 30;

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
  // Le cron de rapprochement clôture sans session utilisateur : le client à
  // cookies n'a alors aucun droit d'écriture sur `tournaments` (règle RLS
  // « organisateur modifie son tournoi », refus silencieux) — il faut le
  // client admin. Repli sur la session de l'organisateur (verdict manuel).
  const admin = creerClientAdmin();
  const ecriture = admin ?? supabase;

  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("id, game_id, season_id, statut, compte_pour_classement")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournoi || tournoi.statut === "termine") {
    return;
  }

  // Pour un tournoi qui compte, « terminé » est écrit EN DERNIER, une fois
  // tous les ratings écrits : « terminé » ferme la porte (garde ci-dessus),
  // donc l'écrire avant laissait un tournoi clos avec des joueurs jamais
  // crédités si une écriture échouait ou si la fonction expirait. Relancer
  // reste sans danger : la fonction SQL refuse tout double crédit.
  const terminer = async () => {
    await ecriture.from("tournaments").update({ statut: "termine" }).eq("id", tournamentId);
  };

  if (!tournoi.compte_pour_classement) {
    await terminer();
    return;
  }

  // Tournoi créé avant l'existence d'une saison courante (brouillon
  // ancien) : on le rattache ici à la saison courante plutôt que de le
  // laisser clôturé sans effet sur le classement.
  let seasonId = tournoi.season_id;
  if (!seasonId) {
    const { data: saisonCourante } = await supabase
      .from("seasons")
      .select("id")
      .eq("game_id", tournoi.game_id)
      .eq("est_courante", true)
      .maybeSingle();
    seasonId = saisonCourante?.id ?? null;
    if (seasonId) {
      await ecriture.from("tournaments").update({ season_id: seasonId }).eq("id", tournamentId);
    }
  }

  // Aucune saison courante : pas de ligne à écrire dans ratings/rating_events
  // (season_id y est NOT NULL). Le tournoi est clôturé, sans effet sur le
  // classement.
  if (!seasonId) {
    await terminer();
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
    await terminer();
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
  // Chaque comptage n'interroge que des verdicts déjà en base (écrits match
  // par match, avant la clôture) — indépendant des autres candidats de
  // cette même clôture, donc sans risque à lancer en parallèle plutôt
  // qu'en série (correctif du 13/09/2026, même logique que sur l'accueil).
  const compteursPrealables = await Promise.all(
    candidats.map((c) => compterVictoiresRecentes(supabase, c.gagnantId, c.perdantId, c.creeLe)),
  );
  const candidatsRetenus = candidats.filter((_, i) => compteursPrealables[i] < 3);

  // État de départ figé de chaque joueur du bracket — jamais l'état
  // courant, qui pourrait déjà refléter un autre match traité juste avant.
  const { data: ratingsData } = await supabase
    .from("ratings")
    .select("profile_id, rating, rd, volatilite, matchs_joues")
    .eq("game_id", tournoi.game_id)
    .eq("season_id", seasonId)
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

  if (!admin) {
    // Pas encore de SUPABASE_SERVICE_ROLE_KEY configurée : le tournoi est
    // clôturé, mais l'écriture du classement est impossible — on échoue
    // proprement plutôt que de contourner la règle CLAUDE.md §6.1 (aucune
    // écriture client sur ratings/rating_events), et on le dit dans les logs.
    console.error(
      `cloturerTournoi : SUPABASE_SERVICE_ROLE_KEY absente, ratings non écrits pour le tournoi ${tournamentId}.`,
    );
    await terminer();
    return;
  }

  // Écritures indépendantes (une par joueur, idempotentes côté SQL) : lancées
  // en parallèle plutôt qu'en série, pour qu'un gros tournoi (jusqu'à 128
  // joueurs) tienne dans le délai d'une fonction serveur.
  const joueursEnEchec = (
    await Promise.all(
      Array.from(joueursDuBracket).map(async (profileId) => {
        const avant = etatDepart.get(profileId)!;
        const resultats = resultatsParJoueur.get(profileId) ?? [];
        const apres = mettreAJourJoueur(avant, resultats);

        const { error } = await admin.rpc("cloturer_rating_joueur", {
          p_profile_id: profileId,
          p_game_id: tournoi.game_id,
          p_season_id: seasonId,
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
        return error ? profileId : null;
      }),
    )
  ).filter((id): id is string => id !== null);

  if (joueursEnEchec.length > 0) {
    // Tournoi laissé « en cours » : mieux vaut un tournoi visiblement non
    // clôturé qu'un tournoi clos où des joueurs n'ont jamais reçu leurs
    // points. Une relance complète les joueurs manquants sans recréditer
    // les autres (garde SQL).
    console.error(
      `cloturerTournoi : écriture du rating échouée pour ${joueursEnEchec.length} joueur(s) du tournoi ${tournamentId} — tournoi laissé ouvert pour reprise.`,
    );
    return;
  }

  await terminer();
}

/**
 * Décroissance mensuelle du RD par inactivité (docs/moteur-resultats.md
 * §4 et §6 — "Joueur inactif" / "Décroissance d'inactivité"). Pour tout
 * joueur dont le rating n'a pas bougé depuis 30 jours (`ratings.maj_le`,
 * mis à jour aussi bien par une clôture de tournoi que par cette tâche
 * elle-même — chaque application repousse naturellement l'échéance des
 * 30 jours suivants, sans état supplémentaire à tenir), le RD remonte
 * selon la formule Glicko-2 "aucun match" ; le rating ne bouge jamais.
 *
 * Destinée à être appelée par un déclencheur planifié (voir
 * src/app/api/cron/decroissance-rd/route.ts) — jamais par le client.
 * Idempotente : `appliquer_decroissance_rd` refuse toute deuxième
 * écriture pour le même joueur dans la même journée.
 */
export async function appliquerDecroissanceInactivite(): Promise<{
  traites: number;
  ignores: number;
}> {
  const supabase = await createClient();
  const admin = creerClientAdmin();
  if (!admin) {
    // Pas de SUPABASE_SERVICE_ROLE_KEY configurée : on ne contourne pas
    // la règle CLAUDE.md §6.1, on abandonne proprement.
    return { traites: 0, ignores: 0 };
  }

  const seuil = new Date(Date.now() - SEUIL_INACTIVITE_JOURS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidats } = await supabase
    .from("ratings")
    .select("profile_id, game_id, season_id, rating, rd, volatilite")
    .lt("maj_le", seuil)
    .lt("rd", RD_MAX);

  let traites = 0;
  let ignores = 0;

  for (const c of candidats ?? []) {
    const avant: EtatGlicko = { rating: c.rating, rd: c.rd, volatilite: c.volatilite };
    const apres = mettreAJourJoueur(avant, []);

    const { data: ecrit } = await admin.rpc("appliquer_decroissance_rd", {
      p_profile_id: c.profile_id,
      p_game_id: c.game_id,
      p_season_id: c.season_id,
      p_rating: avant.rating,
      p_rd_avant: avant.rd,
      p_rd_apres: apres.rd,
      p_volatilite: apres.volatilite,
    });

    if (ecrit) traites += 1;
    else ignores += 1;
  }

  return { traites, ignores };
}

/**
 * Rotation de saison (docs/moteur-resultats.md §4 "Changement de saison"
 * et §6 "Rotation de saison"). Ne décide JAMAIS quand une saison commence
 * ou finit — ça reste une vraie décision produit (création de la ligne
 * `seasons`, avec ses dates, faite ailleurs). Cette fonction se contente
 * de réagir mécaniquement aux dates déjà en base : pour chaque jeu, si une
 * saison existe dont `debut_le` est déjà passé mais qui n'est pas encore
 * marquée `est_courante`, elle fait basculer le classement dessus — soft
 * reset de chaque joueur de l'ancienne saison (formule Glicko-2, jamais
 * une remise à zéro), puis bascule atomique du drapeau `est_courante`.
 *
 * Destinée à être appelée par un déclencheur planifié (voir
 * src/app/api/cron/rotation-saison/route.ts) — jamais par le client.
 * Idempotente : `appliquer_soft_reset_saison` refuse toute deuxième
 * écriture pour le même joueur dans la même saison, et `activer_saison`
 * est un simple changement de drapeau, sans effet s'il est déjà en place.
 */
export async function appliquerRotationSaisons(): Promise<{
  saisonsActivees: number;
  joueursTraites: number;
}> {
  const supabase = await createClient();
  const admin = creerClientAdmin();
  if (!admin) {
    return { saisonsActivees: 0, joueursTraites: 0 };
  }

  const { data: saisons } = await supabase
    .from("seasons")
    .select("id, game_id, numero, debut_le, est_courante");

  const parJeu = new Map<number, NonNullable<typeof saisons>>();
  for (const s of saisons ?? []) {
    const liste = parJeu.get(s.game_id) ?? [];
    liste.push(s);
    parJeu.set(s.game_id, liste);
  }

  let saisonsActivees = 0;
  let joueursTraites = 0;
  const maintenant = Date.now();

  for (const [gameId, liste] of parJeu) {
    const courante = liste.find((s) => s.est_courante) ?? null;
    const cible = liste
      .filter((s) => new Date(s.debut_le).getTime() <= maintenant)
      .sort((a, b) => b.numero - a.numero)[0];

    if (!cible || cible.id === courante?.id) continue;

    if (courante) {
      const { data: ratingsPrecedents } = await supabase
        .from("ratings")
        .select("profile_id, rating, rd, volatilite")
        .eq("game_id", gameId)
        .eq("season_id", courante.id);

      let echecs = 0;
      for (const r of ratingsPrecedents ?? []) {
        const avant: EtatGlicko = { rating: r.rating, rd: r.rd, volatilite: r.volatilite };
        const apres = softResetSaison(avant);

        const { data: ecrit, error } = await admin.rpc("appliquer_soft_reset_saison", {
          p_profile_id: r.profile_id,
          p_game_id: gameId,
          p_season_id: cible.id,
          p_rating_avant: avant.rating,
          p_rd_avant: avant.rd,
          p_volatilite: apres.volatilite,
          p_rating_apres: apres.rating,
          p_rd_apres: apres.rd,
        });

        if (error) echecs += 1;
        else if (ecrit) joueursTraites += 1;
      }

      // Basculer la saison malgré un échec ferait repartir de zéro les
      // joueurs non traités (leur ligne de la nouvelle saison n'existerait
      // pas, et la relance ne les reverrait plus : « cible » serait déjà la
      // saison courante). On laisse donc l'ancienne saison courante : la
      // prochaine exécution reprend — les joueurs déjà traités sont ignorés
      // (garde SQL).
      if (echecs > 0) {
        console.error(
          `appliquerRotationSaisons : soft reset échoué pour ${echecs} joueur(s) du jeu ${gameId} — saison non basculée, reprise à la prochaine exécution.`,
        );
        continue;
      }
    }

    await admin.rpc("activer_saison", { p_game_id: gameId, p_nouvelle_saison_id: cible.id });
    saisonsActivees += 1;
  }

  return { saisonsActivees, joueursTraites };
}
