// Équipes inscrites aux tournois 5v5 (03/10/2026, audit N21) : nom, tag et
// cinq joueurs alignés de chaque inscription d'équipe. Dans le bracket, une
// équipe est représentée par son capitaine (match_participants.profile_id) ;
// ce chargement permet de retrouver l'équipe derrière chaque capitaine.
// Lecture seule, sur des tables publiques : utilisable avec le client du
// visiteur comme avec le client serveur.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { libelleEquipe, parcoursDansTournoi } from "@/lib/cinq-contre-cinq";

export interface EquipeInscrite {
  registrationId: string;
  tournamentId: string;
  capitaineId: string;
  /** Nul si l'équipe a été supprimée depuis (le nom figé reste affiché). */
  slug: string | null;
  nom: string;
  tag: string | null;
  /** « [TAG] Nom ». */
  libelle: string;
  /** Joueurs alignés (profile_id), capitaine compris. */
  joueurs: string[];
}

export function cleEquipe(tournamentId: string, capitaineId: string): string {
  return `${tournamentId}:${capitaineId}`;
}

/** Équipes inscrites (inscription non retirée), par tournoi et capitaine. */
export async function chargerEquipesDesTournois(
  supabase: SupabaseClient<Database>,
  tournamentIds: string[],
): Promise<Map<string, EquipeInscrite>> {
  const equipes = new Map<string, EquipeInscrite>();
  if (tournamentIds.length === 0) return equipes;

  const { data } = await supabase
    .from("registrations")
    .select("id, tournament_id, profile_id, equipe_nom, equipe_tag, team:teams(slug), alignements(profile_id)")
    .in("tournament_id", tournamentIds)
    .not("equipe_nom", "is", null)
    .neq("statut", "retire");

  for (const r of data ?? []) {
    if (!r.equipe_nom) continue;
    const capitaineEnTete = [...r.alignements.map((a) => a.profile_id)].sort((x, y) =>
      x === r.profile_id ? -1 : y === r.profile_id ? 1 : 0,
    );
    equipes.set(cleEquipe(r.tournament_id, r.profile_id), {
      registrationId: r.id,
      tournamentId: r.tournament_id,
      capitaineId: r.profile_id,
      slug: r.team?.slug ?? null,
      nom: r.equipe_nom,
      tag: r.equipe_tag,
      libelle: libelleEquipe(r.equipe_tag, r.equipe_nom),
      joueurs: capitaineEnTete,
    });
  }
  return equipes;
}

/** Équipe dans laquelle un joueur est aligné pour ce tournoi, s'il l'est. */
export function equipeDuJoueur(
  equipes: Map<string, EquipeInscrite>,
  tournamentId: string,
  profileId: string,
): EquipeInscrite | undefined {
  for (const equipe of equipes.values()) {
    if (equipe.tournamentId === tournamentId && equipe.joueurs.includes(profileId)) return equipe;
  }
  return undefined;
}

export interface LignePalmares {
  slug: string;
  nom: string;
  debuteLe: string;
  libelle: string;
  victoiresVerifiees: number;
}

/**
 * Palmarès d'une équipe : ses tournois 5v5 (inscription non retirée), du
 * plus récent au plus ancien, et où elle s'y est arrêtée.
 */
export async function chargerPalmaresEquipe(
  supabase: SupabaseClient<Database>,
  teamId: string,
  capitaineId: string,
): Promise<LignePalmares[]> {
  const { data: inscriptions } = await supabase
    .from("registrations")
    .select("tournament:tournaments(id, nom, slug, statut, debute_le, capacite)")
    .eq("team_id", teamId)
    .neq("statut", "retire");
  const tournois = (inscriptions ?? [])
    .flatMap((i) => (i.tournament && i.tournament.statut !== "brouillon" ? [i.tournament] : []))
    .sort((a, b) => b.debute_le.localeCompare(a.debute_le))
    .slice(0, 20);
  if (tournois.length === 0) return [];

  const { data: matchs } = await supabase
    .from("match_participants")
    .select("est_gagnant, match:matches!inner(tour, tournament_id, match_verdicts(niveau, est_definitif))")
    .eq("profile_id", capitaineId)
    .in(
      "match.tournament_id",
      tournois.map((t) => t.id),
    );

  return tournois.map((t) => {
    const { libelle, victoiresVerifiees } = parcoursDansTournoi({
      statut: t.statut,
      capacite: t.capacite,
      matchs: (matchs ?? [])
        .filter((m) => m.match.tournament_id === t.id)
        .map((m) => ({
          tour: m.match.tour,
          estGagnant: m.est_gagnant,
          verifie: m.match.match_verdicts.some((v) => v.est_definitif && v.niveau !== "manuel"),
        })),
    });
    return { slug: t.slug, nom: t.nom, debuteLe: t.debute_le, libelle, victoiresVerifiees };
  });
}
