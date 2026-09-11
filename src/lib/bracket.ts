// Logique pure de placement dans un bracket à élimination simple — séparée
// de organisation-actions.ts (qui orchestre les appels Supabase) pour
// pouvoir être testée sans dépendre du serveur. Cette fonction a eu deux
// vrais bugs de production (voir [[najarena-roadmap-schema]]) ; les tests
// couvrent exactement ces régressions.

// Ordre standard de placement : répartit les "byes" (places vides quand il
// y a moins de joueurs que de places) le plus loin possible les uns des
// autres, pour qu'aucun match ne se retrouve avec deux places vides à la
// fois — sans cet ordre, un match sans aucun participant ne se résoudrait
// jamais et bloquerait tout le tour suivant. Pour capacite=4 : [1,4,2,3]
// (seed1 vs seed4, seed2 vs seed3).
export function ordreDesSeeds(capacite: number): number[] {
  if (capacite === 1) return [1];
  const precedent = ordreDesSeeds(capacite / 2);
  const resultat: number[] = [];
  for (const s of precedent) {
    resultat.push(s, capacite + 1 - s);
  }
  return resultat;
}
