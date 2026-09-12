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

export interface ByeAResoudre {
  tour: number;
  position: number;
  gagnantSeed: number; // 1-indexé — le joueur réel à ce seed remporte le bye
}

/**
 * Calcule, pour un bracket fraîchement généré, la liste des matchs qui
 * doivent être immédiatement résolus comme "bye" (un seul participant
 * réel, l'autre place restant vide faute d'inscrits) — et propage la
 * cascade sur plusieurs tours si nécessaire.
 *
 * Simulation PURE (aucun accès base de données) de ce que
 * organisation-actions.ts applique ensuite via la RPC
 * `enregistrer_verdict_manuel` — extraite ici pour être testée
 * indépendamment, après que cette logique a déjà eu trois vrais bugs de
 * production :
 *
 * 1. Ordre de seeding naïf plaçant deux vrais joueurs côte à côte,
 *    laissant un match du tour 1 totalement vide (corrigé par
 *    `ordreDesSeeds`, ci-dessus).
 * 2. Un match à 1 participant avancé à tort avant qu'un VRAI match du
 *    tour précédent (2 joueurs, pas encore joué) ne soit décidé —
 *    corrigé en ne résolvant un match que si tous ses prédécesseurs sont
 *    "décidés".
 * 3. Un match totalement VIDE (0 participant des deux côtés — capacité
 *    largement supérieure au nombre d'inscrits) ne devient jamais
 *    "décidé" au sens du bug #2, bloquant indéfiniment son match
 *    suivant même quand l'AUTRE côté avait déjà un bye prêt à avancer.
 *    Corrigé ici : un prédécesseur sans aucun participant ne compte
 *    jamais comme "encore à décider", puisqu'il ne pourra structurellement
 *    plus jamais en obtenir un.
 */
export function calculerByesEnCascade(capacite: number, nbJoueursConfirmes: number): ByeAResoudre[] {
  const nbTours = Math.log2(capacite);
  const ordre = ordreDesSeeds(capacite);

  // Pour chaque "tour-position", les seeds réels actuellement présents
  // (0, 1 ou 2 — jamais plus). Un vrai match à 2 joueurs ne propage rien
  // tant qu'il n'a pas été réellement joué (hors de ce calcul).
  const participantsParMatch = new Map<string, number[]>();

  for (let position = 1; position <= capacite / 2; position++) {
    const seedA = ordre[(position - 1) * 2];
    const seedB = ordre[(position - 1) * 2 + 1];
    const participants: number[] = [];
    if (seedA <= nbJoueursConfirmes) participants.push(seedA);
    if (seedB <= nbJoueursConfirmes) participants.push(seedB);
    participantsParMatch.set(`1-${position}`, participants);
  }

  const resolutions: ByeAResoudre[] = [];

  for (let tour = 1; tour < nbTours; tour++) {
    const nbMatchsCeTour = capacite / 2 ** tour;
    for (let position = 1; position <= nbMatchsCeTour; position++) {
      const participants = participantsParMatch.get(`${tour}-${position}`) ?? [];
      const positionSuivante = Math.ceil(position / 2);
      const cleSuivante = `${tour + 1}-${positionSuivante}`;
      if (!participantsParMatch.has(cleSuivante)) participantsParMatch.set(cleSuivante, []);

      if (participants.length === 1) {
        resolutions.push({ tour, position, gagnantSeed: participants[0] });
        participantsParMatch.get(cleSuivante)!.push(participants[0]);
      }
      // participants.length === 0 : match vide, rien à propager (bug #3).
      // participants.length === 2 : vrai match non joué, rien à propager
      // tant que son verdict n'existe pas.
    }
  }

  return resolutions;
}
