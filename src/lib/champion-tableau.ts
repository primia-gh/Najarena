// Carte « Vainqueur » au bout du tableau d'un tournoi à élimination directe
// (moment fort « le tableau qui se remplit », 27/11/2026). Ne compte que les
// victoires lues chez Riot : un verdict manuel n'est jamais une preuve
// (CLAUDE.md §3), et la carte ne passe en vert que si la finale est vérifiée.

export interface MatchChampion {
  id: string;
  tour: number;
}

export interface VerdictChampion {
  gagnant_id: string | null;
  niveau: string;
}

export function bilanChampion(
  matchs: readonly MatchChampion[],
  verdicts: ReadonlyMap<string, VerdictChampion>,
  championId: string,
): { victoiresVerifiees: number; finaleVerifiee: boolean } {
  if (matchs.length === 0) return { victoiresVerifiees: 0, finaleVerifiee: false };
  const dernierTour = Math.max(...matchs.map((m) => m.tour));
  let victoiresVerifiees = 0;
  let finaleVerifiee = false;
  for (const m of matchs) {
    const v = verdicts.get(m.id);
    if (!v || v.gagnant_id !== championId || v.niveau === "manuel") continue;
    victoiresVerifiees++;
    if (m.tour === dernierTour) finaleVerifiee = true;
  }
  return { victoiresVerifiees, finaleVerifiee };
}
