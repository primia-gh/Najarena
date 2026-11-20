import { createClient } from "@/lib/supabase/server";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";
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
  /** Riot ID : celui de la partie lue chez Riot, sinon le compte principal lié. */
  riotId: string | null;
  /** La fiche de la partie a été lue chez Riot pour ce joueur. */
  partieLue: boolean;
  /**
   * Vrai seulement si cette fiche désigne ce compte. Une fiche lue avant le
   * 03/10/2026 ne garde pas le compte joué : partie lue, compte non précisé.
   */
  compteDeLaPartie: boolean;
  /** La fiche désigne un compte que le joueur a délié depuis : on ne montre pas son compte actuel. */
  compteDelie: boolean;
  champion: string | null;
}

/**
 * Match 5v5 (18/11/2026) : chaque côté est une équipe, représentée dans le
 * bracket par son capitaine ; la fiche montre ses cinq joueurs alignés.
 */
export interface EquipePreuve {
  capitaineId: string;
  libelle: string;
  slug: string | null;
  gagnant: boolean | null;
  joueurs: JoueurPreuve[];
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
  /** Format suisse (19/11/2026) : des rondes, pas de finale. */
  suisse: boolean;
  /** Double élimination (20/11/2026) : tableau du match. */
  tableau: string | null;
  statut: string;
  demarreLe: string | null;
  tournoi: { nom: string; slug: string; format: string; nature: string; classe: boolean | null; statut: string };
  /** Capitaines en 5v5, joueurs en 1v1. */
  joueurs: JoueurPreuve[];
  /** Les deux équipes d'un match 5v5, nul sinon. */
  equipes: EquipePreuve[] | null;
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
      "id, tour, tableau, statut, demarre_le, defaite_reconnue_par, defaite_reconnue_le, tournament:tournaments(id, nom, slug, format, nature, classe, statut, capacite, type_bracket), match_participants(profile_id, est_gagnant, pret_le, profile:profiles(pseudo, slug)), match_verdicts(niveau, gagnant_id, riot_match_id, motif, est_definitif, cree_le, decideur:profiles!match_verdicts_decide_par_fkey(pseudo))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!m?.tournament) return null;

  // 5v5 : l'équipe derrière chaque capitaine, et ses joueurs alignés.
  const capitaines = m.match_participants.map((p) => p.profile_id);
  const equipesInscrites =
    m.tournament.format === "5v5" ? await chargerEquipesDesTournois(supabase, [m.tournament.id]) : null;
  const equipeDe = (capitaineId: string) => equipesInscrites?.get(cleEquipe(m.tournament!.id, capitaineId));
  const alignes = capitaines.flatMap((id) => equipeDe(id)?.joueurs ?? []);
  const ids = [...new Set([...capitaines, ...alignes])];
  const autres = ids.filter((id) => !capitaines.includes(id));
  const [{ data: stats }, { data: comptes }, { data: lignes }, { data: profilsAlignes }] = await Promise.all([
    supabase
      .from("stats_match_joueur")
      .select("profile_id, puuid, champion, duree_secondes")
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
          .in("profile_id", capitaines)
          .order("numero", { ascending: true })
      : Promise.resolve({ data: [] }),
    autres.length > 0
      ? supabase.from("profiles").select("id, pseudo, slug").in("id", autres)
      : Promise.resolve({ data: [] }),
  ]);

  const pseudoDe = (profileId: string) =>
    m.match_participants.find((p) => p.profile_id === profileId)?.profile?.pseudo ?? "Joueur supprimé";
  const verdict = m.match_verdicts.find((v) => v.est_definitif) ?? null;

  const joueurDe = (
    profileId: string,
    profil: { pseudo: string; slug: string | null } | null | undefined,
    gagnant: boolean | null,
    pretLe: string | null,
  ): JoueurPreuve => {
    const s = (stats ?? []).find((x) => x.profile_id === profileId);
    const comptesJoueur = (comptes ?? []).filter((c) => c.profile_id === profileId);
    // Une fiche ne compte que derrière un verdict lu chez Riot (jamais un
    // verdict manuel ni un match sans verdict).
    const fiche = verdict && verdict.niveau !== "manuel" ? s : undefined;
    const compteJoue = fiche?.puuid ? comptesJoueur.find((c) => c.puuid === fiche.puuid) : undefined;
    const compteDelie = Boolean(fiche?.puuid) && !compteJoue;
    const compte = compteDelie ? null : (compteJoue ?? comptesJoueur.find((c) => c.est_principal) ?? null);
    return {
      profileId,
      pseudo: profil?.pseudo ?? "Joueur supprimé",
      slug: profil?.slug ?? null,
      gagnant,
      pretLe,
      riotId: compte ? `${compte.riot_game_name}#${compte.riot_tag_line}` : null,
      partieLue: Boolean(fiche),
      compteDeLaPartie: Boolean(compteJoue),
      compteDelie,
      champion: fiche?.champion ?? null,
    };
  };

  const joueurs: JoueurPreuve[] = m.match_participants.map((p) =>
    joueurDe(p.profile_id, p.profile, verdict ? verdict.gagnant_id === p.profile_id : p.est_gagnant, p.pret_le),
  );

  const equipes: EquipePreuve[] | null = equipesInscrites
    ? joueurs.map((capitaine) => {
        const equipe = equipeDe(capitaine.profileId);
        const profilDe = (id: string) =>
          id === capitaine.profileId
            ? { pseudo: capitaine.pseudo, slug: capitaine.slug }
            : (profilsAlignes ?? []).find((x) => x.id === id);
        return {
          capitaineId: capitaine.profileId,
          libelle: equipe?.libelle ?? `Équipe de ${capitaine.pseudo}`,
          slug: equipe?.slug ?? null,
          gagnant: capitaine.gagnant,
          joueurs: (equipe?.joueurs ?? [capitaine.profileId]).map((id) =>
            id === capitaine.profileId ? capitaine : joueurDe(id, profilDe(id), capitaine.gagnant, null),
          ),
        };
      })
    : null;

  return {
    id: m.id,
    tour: m.tour,
    dernierTour: Math.max(1, Math.round(Math.log2(m.tournament.capacite))),
    suisse: m.tournament.type_bracket === "suisse",
    tableau: m.tableau,
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
    equipes,
    verdict: verdict
      ? {
          niveau: verdict.niveau,
          riotMatchId: verdict.riot_match_id,
          motif: verdict.motif,
          decideur: verdict.decideur?.pseudo ?? null,
          decideLe: verdict.cree_le,
          gagnant: verdict.gagnant_id
            ? (equipes?.find((e) => e.capitaineId === verdict.gagnant_id)?.libelle ?? pseudoDe(verdict.gagnant_id))
            : null,
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
