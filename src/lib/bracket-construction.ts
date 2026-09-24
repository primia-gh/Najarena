import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ordreDesSeeds, calculerByesEnCascade } from "@/lib/bracket";

// Écriture d'un bracket en base à partir d'une liste de joueurs — sortie
// de genererBracket (organisation-actions.ts) le 24/09/2026 pour être
// partagée avec le démarrage automatique des tournois quotidiens
// (lib/tournois-auto/execution.ts). Une seule copie de cette logique :
// elle a déjà eu trois bugs de production (voir lib/bracket.ts), la
// dupliquer reviendrait à devoir les corriger deux fois.
//
// Ne vérifie pas qui appelle : c'est le rôle de l'appelant (organisateur
// vérifié par sa session, ou tâche planifiée authentifiée par
// CRON_SECRET). Seule différence entre les deux : la façon d'enregistrer
// un bye (resoudreBye).

// Tirage au sort des places (seeds) — identique pour les tournois
// d'organisateur et les tournois automatiques.
export function melanger<T>(items: T[]): T[] {
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

export async function construireBracket(
  supabase: SupabaseClient<Database>,
  tournamentId: string,
  capacite: number,
  // Dans l'ordre des seeds : joueurs[0] = seed 1.
  joueurs: string[],
  resoudreBye: (matchId: string, gagnantId: string) => Promise<void>,
): Promise<{ ok: boolean }> {
  const nbTours = Math.log2(capacite);

  // Les tours se créent du dernier au premier : match_suivant_id doit
  // référencer un match déjà existant.
  const idParTourPosition = new Map<string, string>();
  for (let tour = nbTours; tour >= 1; tour--) {
    const nbMatchsCeTour = capacite / 2 ** tour;
    for (let position = 1; position <= nbMatchsCeTour; position++) {
      const matchSuivantId =
        tour < nbTours ? idParTourPosition.get(`${tour + 1}-${Math.ceil(position / 2)}`) : null;

      const { data: nouveauMatch, error } = await supabase
        .from("matches")
        .insert({ tournament_id: tournamentId, tour, position, match_suivant_id: matchSuivantId })
        .select("id")
        .single();

      if (error || !nouveauMatch) {
        return { ok: false };
      }

      idParTourPosition.set(`${tour}-${position}`, nouveauMatch.id);
    }
  }

  // Place chaque joueur à la position que lui attribue l'ordre des seeds ;
  // les places au-delà du nombre de joueurs confirmés restent vides (bye).
  const ordre = ordreDesSeeds(capacite);
  for (let slotIndex = 0; slotIndex < capacite; slotIndex++) {
    const numeroSeed = ordre[slotIndex];
    if (numeroSeed > joueurs.length) continue;

    const position = Math.floor(slotIndex / 2) + 1;
    const slot = (slotIndex % 2) + 1;
    const matchId = idParTourPosition.get(`1-${position}`);
    if (!matchId) continue;

    await supabase.from("match_participants").insert({
      match_id: matchId,
      profile_id: joueurs[numeroSeed - 1],
      slot,
    });
  }

  // Un match du tour 1 dont les deux places sont occupées par de vrais
  // joueurs démarre immédiatement (pas de bye à résoudre) : c'est le
  // déclencheur de la recherche de résultat niveau 2 (docs/moteur-
  // resultats.md §3 — la fenêtre T+8/.../T+25 se compte depuis ce moment).
  for (let position = 1; position <= capacite / 2; position++) {
    const seedA = ordre[(position - 1) * 2];
    const seedB = ordre[(position - 1) * 2 + 1];
    if (seedA > joueurs.length || seedB > joueurs.length) continue;

    const matchId = idParTourPosition.get(`1-${position}`);
    if (!matchId) continue;

    await supabase
      .from("matches")
      .update({ statut: "en_cours", demarre_le: new Date().toISOString() })
      .eq("id", matchId);
  }

  // Résout les byes en cascade (logique pure testée dans bracket.test.ts —
  // cf. les commentaires de calculerByesEnCascade pour l'historique des
  // trois bugs déjà trouvés sur cette logique). Chaque résolution avance
  // le joueur directement au tour suivant, motif consigné comme tout
  // verdict manuel.
  const byes = calculerByesEnCascade(capacite, joueurs.length);
  for (const bye of byes) {
    const matchId = idParTourPosition.get(`${bye.tour}-${bye.position}`);
    if (!matchId) continue;

    await resoudreBye(matchId, joueurs[bye.gagnantSeed - 1]);
  }

  return { ok: true };
}
