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
// public (recalcul.ts). Le même seuil est écrit en base dans
// matchs_communs (recommandations, docs/schema.sql) : les deux à changer
// ensemble.

export const NIVEAU_COMPTE_RIOT_MIN = 30;

/**
 * Le niveau gardé avec le verdict permet-il de compter ce match ? Vide
 * (verdict d'avant le 22/11/2026, 5v5 ; la base n'accepte plus de verdict
 * 1v1 lu chez Riot sans niveau) : rien à reprocher, il compte.
 */
export function niveauCompteSuffisant(niveauCompteMin: number | null | undefined): boolean {
  return niveauCompteMin === null || niveauCompteMin === undefined || niveauCompteMin >= NIVEAU_COMPTE_RIOT_MIN;
}

/**
 * Un verdict qui entre dans les chiffres « matchs vérifiés » (CV, widget,
 * API, image de partage, bloc « Comptes Riot ») : définitif, lu chez Riot
 * (pas manuel), comptes de niveau suffisant. `niveauCompte` = niveau du
 * compte du joueur dans la fiche de partie, quand on l'a.
 */
export function verdictCompteAuCV(
  v: { est_definitif?: boolean; niveau: string; niveau_compte_min: number | null },
  niveauCompte?: number | null,
): boolean {
  return (
    v.est_definitif !== false &&
    v.niveau !== "manuel" &&
    niveauCompteSuffisant(v.niveau_compte_min) &&
    niveauCompteSuffisant(niveauCompte)
  );
}

/**
 * Plus bas niveau Riot des comptes donnés sur toutes les parties d'une
 * série. Nul si Riot ne l'a pas fourni pour l'un d'eux : la base refuse
 * alors le verdict 1v1 (NIVEAU_COMPTE_REQUIS, 23/11/2026), rien n'est
 * enregistré et l'organisateur tranche après le délai.
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

/** La règle à la troisième personne, pour un CV lu par d'autres. */
export const REGLE_NIVEAU_COMPTE_CV = `Un match joué avec un compte Riot sous le niveau ${NIVEAU_COMPTE_RIOT_MIN} reste vérifié, mais ne rapporte aucun point : il n'entre ni dans le taux de victoire ni dans le nombre de matchs vérifiés.`;

/** « A », « A et B », « A, B et C ». */
export function listeFrancaise(elements: string[]): string {
  if (elements.length <= 1) return elements[0] ?? "";
  return `${elements.slice(0, -1).join(", ")} et ${elements[elements.length - 1]}`;
}

