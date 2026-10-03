import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Pronostics d'un tournoi (audit N20) : répartition publique par match et,
// pour le visiteur connecté, ses propres choix (la base ne lui montre que
// les siens).

export interface PronosticsTournoi {
  /** match → (joueur désigné → nombre de pronostics) */
  repartition: Map<string, Map<string, number>>;
  /** match → joueur que le visiteur a désigné */
  miens: Map<string, string>;
}

export async function chargerPronosticsTournoi(
  supabase: SupabaseClient<Database>,
  tournamentId: string,
  matchIds: string[],
  moi: string | undefined,
): Promise<PronosticsTournoi> {
  const repartition = new Map<string, Map<string, number>>();
  const miens = new Map<string, string>();
  if (matchIds.length === 0) return { repartition, miens };

  const [{ data: lignes }, { data: mesLignes }] = await Promise.all([
    supabase.rpc("repartition_pronostics", { p_tournament_id: tournamentId }),
    moi
      ? supabase.from("pronostics").select("match_id, gagnant_prevu").eq("profile_id", moi).in("match_id", matchIds)
      : Promise.resolve({ data: [] }),
  ]);
  for (const l of lignes ?? []) {
    const parJoueur = repartition.get(l.match_id) ?? new Map<string, number>();
    parJoueur.set(l.gagnant_prevu, l.nombre);
    repartition.set(l.match_id, parJoueur);
  }
  for (const l of mesLignes ?? []) miens.set(l.match_id, l.gagnant_prevu);
  return { repartition, miens };
}
