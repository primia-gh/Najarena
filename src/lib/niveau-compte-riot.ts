// Niveau Riot minimum pour compter au classement (contrôle de sécurité du
// 21/11/2026, M4 ; choix du porteur du projet le 22/11/2026). Un compte
// Riot neuf est gratuit : un joueur pouvait en créer, les lier à de faux
// comptes Najarena et se fabriquer des victoires. Atteindre le niveau 30
// (celui que Riot exige pour ses parties classées) demande des dizaines
// d'heures de jeu.
//
// Le niveau des deux comptes d'un match 1v1 est lu dans la partie
// retrouvée chez Riot, sans appel de plus, et gardé avec le verdict
// (match_verdicts.niveau_compte_min). Un match sous ce niveau reste
// vérifié — le résultat est vrai — mais ne rapporte ni ne coûte de points.
// Mêmes règles à la clôture (classement-actions.ts) et dans le recalcul
// public (recalcul.ts).

export const NIVEAU_COMPTE_RIOT_MIN = 30;

/**
 * Le niveau gardé avec le verdict permet-il de compter ce match ? Vide
 * (verdict d'avant le 22/11/2026, 5v5) : rien à reprocher, il compte.
 */
export function niveauCompteSuffisant(niveauCompteMin: number | null | undefined): boolean {
  return niveauCompteMin === null || niveauCompteMin === undefined || niveauCompteMin >= NIVEAU_COMPTE_RIOT_MIN;
}

/**
 * Plus bas niveau Riot des comptes donnés sur toutes les parties d'une
 * série. Nul si Riot ne l'a pas fourni pour l'un d'eux (le match compte
 * alors comme avant).
 */
export function niveauMinimumSerie(niveaux: (number | undefined)[]): number | null {
  if (niveaux.length === 0) return null;
  let minimum = Infinity;
  for (const n of niveaux) {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    minimum = Math.min(minimum, n);
  }
  return Math.floor(minimum);
}

/**
 * Mention d'un match lu chez Riot mais joué avec un compte sous le niveau
 * 30 (revue design du 23/11/2026) : la même partout (face-à-face, CV,
 * page du tournoi). Le résultat reste vérifié : seuls les points (et le
 * bilan du face-à-face) l'ignorent.
 */
export const MENTION_SANS_POINTS = `Sans points : compte Riot sous le niveau ${NIVEAU_COMPTE_RIOT_MIN}`;

/** « 1 match sans points » / « 3 matchs sans points ». */
export function matchsSansPoints(n: number): string {
  return `${n} match${n > 1 ? "s" : ""} sans points`;
}

/** La règle en une phrase, avec ce qu'il faut faire. */
export const REGLE_NIVEAU_COMPTE = `Un match joué avec un compte Riot sous le niveau ${NIVEAU_COMPTE_RIOT_MIN} reste vérifié, mais ne rapporte aucun point. Atteins le niveau ${NIVEAU_COMPTE_RIOT_MIN} pour que tes matchs comptent.`;

/** « A », « A et B », « A, B et C ». */
export function listeFrancaise(elements: string[]): string {
  if (elements.length <= 1) return elements[0] ?? "";
  return `${elements.slice(0, -1).join(", ")} et ${elements[elements.length - 1]}`;
}

