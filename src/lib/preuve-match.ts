import { createClient } from "@/lib/supabase/server";
import type { NiveauVerdict } from "@/lib/tournois";

// Fiche de preuve d'un match (09/10/2026, idée en réserve n°1) : tout ce
// qui fonde un résultat, à une seule adresse — verdict et sa source,
// identifiant de la partie chez Riot, heure de lecture, comptes Riot qui
// ont joué, et les lignes du registre scellé qu'a produites le tournoi.
// Simple lecture de données déjà publiques (RLS : lisibles par tous).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface JoueurPreuve {
  profileId: string;
  pseudo: string;
  slug: string | null;
  gagnant: boolean | null;
  pretLe: string | null;
  /** Riot ID du compte qui a joué (celui de la partie lue, sinon le compte principal). */
  riotId: string | null;
  champion: string | null;
  kda: string | null;
}

export interface LigneRegistrePreuve {
  numero: number;
  pseudo: string;
  ratingAvant: number;
  ratingApres: number;
  empreinte: string;
}

export interface PreuveMatch {
  id: string;
  tour: number;
  dernierTour: number;
  statut: string;
  demarreLe: string | null;
  tournoi: { nom: string; slug: string; format: string; nature: string; classe: boolean | null; statut: string };
  joueurs: JoueurPreuve[];
  verdict: {
    niveau: NiveauVerdict;
    riotMatchId: string | null;
    motif: string | null;
    decideur: string | null;
    decideLe: string;
    gagnant: string | null;
  } | null;
  defaiteReconnue: { pseudo: string; le: string | null } | null;
  dureeSecondes: number | null;
  registre: LigneRegistrePreuve[];
}

export async function chargerPreuveMatch(id: string): Promise<PreuveMatch | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();

  const { data: m } = await supabase
    .from("matches")
    .select(
      "id, tour, statut, demarre_le, defaite_reconnue_par, defaite_reconnue_le, tournament:tournaments(id, nom, slug, format, nature, classe, statut, capacite), match_participants(profile_id, est_gagnant, pret_le, profile:profiles(pseudo, slug)), match_verdicts(niveau, gagnant_id, riot_match_id, motif, est_definitif, cree_le, decideur:profiles!match_verdicts_decide_par_fkey(pseudo))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!m?.tournament) return null;

  const ids = m.match_participants.map((p) => p.profile_id);
  const [{ data: stats }, { data: comptes }, { data: lignes }] = await Promise.all([
    supabase
      .from("stats_match_joueur")
      .select("profile_id, puuid, champion, kills, deaths, assists, duree_secondes")
      .eq("match_id", id),
    ids.length > 0
      ? supabase
          .from("game_accounts")
          .select("profile_id, puuid, riot_game_name, riot_tag_line, est_principal")
          .in("profile_id", ids)
          .eq("game_id", 1)
          .not("verifie_le", "is", null)
      : Promise.resolve({ data: [] }),
    ids.length > 0
      ? supabase
          .from("rating_events")
          .select("numero, profile_id, rating_avant, rating_apres, empreinte")
          .eq("tournament_id", m.tournament.id)
          .eq("motif", "tournoi")
          .in("profile_id", ids)
          .order("numero", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const pseudoDe = (profileId: string) =>
    m.match_participants.find((p) => p.profile_id === profileId)?.profile?.pseudo ?? "Joueur supprimé";
  const verdict = m.match_verdicts.find((v) => v.est_definitif) ?? null;

  const joueurs: JoueurPreuve[] = m.match_participants.map((p) => {
    const s = (stats ?? []).find((x) => x.profile_id === p.profile_id);
    const comptesJoueur = (comptes ?? []).filter((c) => c.profile_id === p.profile_id);
    const compte =
      (s?.puuid ? comptesJoueur.find((c) => c.puuid === s.puuid) : undefined) ??
      comptesJoueur.find((c) => c.est_principal) ??
      null;
    return {
      profileId: p.profile_id,
      pseudo: p.profile?.pseudo ?? "Joueur supprimé",
      slug: p.profile?.slug ?? null,
      gagnant: verdict ? verdict.gagnant_id === p.profile_id : p.est_gagnant,
      pretLe: p.pret_le,
      riotId: compte ? `${compte.riot_game_name}#${compte.riot_tag_line}` : null,
      champion: s?.champion ?? null,
      kda: s ? `${s.kills}/${s.deaths}/${s.assists}` : null,
    };
  });

  return {
    id: m.id,
    tour: m.tour,
    dernierTour: Math.max(1, Math.round(Math.log2(m.tournament.capacite))),
    statut: m.statut,
    demarreLe: m.demarre_le,
    tournoi: {
      nom: m.tournament.nom,
      slug: m.tournament.slug,
      format: m.tournament.format,
      nature: m.tournament.nature,
      classe: m.tournament.classe,
      statut: m.tournament.statut,
    },
    joueurs,
    verdict: verdict
      ? {
          niveau: verdict.niveau,
          riotMatchId: verdict.riot_match_id,
          motif: verdict.motif,
          decideur: verdict.decideur?.pseudo ?? null,
          decideLe: verdict.cree_le,
          gagnant: verdict.gagnant_id ? pseudoDe(verdict.gagnant_id) : null,
        }
      : null,
    defaiteReconnue: m.defaite_reconnue_par
      ? { pseudo: pseudoDe(m.defaite_reconnue_par), le: m.defaite_reconnue_le }
      : null,
    dureeSecondes: (stats ?? [])[0]?.duree_secondes ?? null,
    registre: (lignes ?? []).map((l) => ({
      numero: l.numero ?? 0,
      pseudo: pseudoDe(l.profile_id),
      ratingAvant: Number(l.rating_avant),
      ratingApres: Number(l.rating_apres),
      empreinte: l.empreinte,
    })),
  };
}
