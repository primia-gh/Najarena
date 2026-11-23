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
