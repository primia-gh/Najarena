// Chiffres en tête du CV (« Victoires X % », « N matchs vérifiés ») et de
// sa description Google. Décision du porteur du projet du 23/11/2026, même
// règle que le classement et le face-à-face : un match lu chez Riot avec un
// compte sous le niveau 30 reste listé et vérifié, mais n'entre dans aucun
// de ces chiffres ; il est dit à part (« + N sans points »), comme un
// verdict manuel. Logique pure, testée dans chiffres-cv.test.ts. Les
// textes passent par typographie() à l'affichage (espaces insécables).

import { matchsSansPoints } from "./niveau-compte-riot";

// « + » collé à son nombre, « · » à ce qui le précède : jamais seuls en bout ou
// en début de ligne.
const NBSP = " ";
const SEP = `${NBSP}· `;

export interface MatchCV {
  estGagnant: boolean | null;
  niveau: string;
  /** Lu chez Riot, mais un compte sous le niveau 30. */
  horsClassementNiveau: boolean;
}

export interface ChiffresCV {
  /** Matchs qui comptent dans le taux de victoire (manuels compris, comme avant). */
  matchsComptes: number;
  victoires: number;
  defaites: number;
  tauxVictoire: number | null;
  /** Lus chez Riot, comptes de niveau 30 (ou d'avant la règle). */
  matchsVerifies: number;
  matchsManuels: number;
  /** Lus chez Riot, mais un compte sous le niveau 30. */
  matchsSansPoints: number;
}

export function chiffresCV(historique: MatchCV[]): ChiffresCV {
  const comptes = historique.filter((h) => !h.horsClassementNiveau);
  const victoires = comptes.filter((h) => h.estGagnant).length;
  const matchsManuels = comptes.filter((h) => h.niveau === "manuel").length;
  return {
    matchsComptes: comptes.length,
    victoires,
    defaites: comptes.length - victoires,
    tauxVictoire: comptes.length > 0 ? Math.round((victoires / comptes.length) * 100) : null,
    matchsVerifies: comptes.length - matchsManuels,
    matchsManuels,
    matchsSansPoints: historique.length - comptes.length,
  };
}

/** « + 2 sans points » ; vide s'il n'y en a pas. */
export function plusSansPoints(n: number): string {
  return n > 0 ? `+${NBSP}${n} sans points` : "";
}

/** Sous « Matchs vérifiés » : ce qui est écarté du chiffre, et pourquoi. */
export function sousMatchsVerifies(c: ChiffresCV): string {
  const manuels = `+${NBSP}${c.matchsManuels} manuel${c.matchsManuels > 1 ? "s" : ""}`;
  if (c.matchsManuels > 0 && c.matchsSansPoints > 0) return `${manuels}${SEP}${plusSansPoints(c.matchsSansPoints)}`;
  if (c.matchsManuels > 0) return `${manuels}, hors classement`;
  if (c.matchsSansPoints > 0) return plusSansPoints(c.matchsSansPoints);
  return "Données officielles";
}

/** Sous « Victoires ». */
export function sousVictoires(c: ChiffresCV): string {
  if (c.matchsComptes > 0) {
    const base = `${c.victoires} V${SEP}${c.defaites} D`;
    return c.matchsSansPoints > 0 ? `${base}${SEP}${plusSansPoints(c.matchsSansPoints)}` : base;
  }
  return c.matchsSansPoints > 0 ? matchsSansPoints(c.matchsSansPoints) : "Aucun match joué";
}

/** « 12 matchs vérifiés » ou « 12 matchs vérifiés + 3 sans points » (description Google). */
export function resumeMatchsVerifies(c: ChiffresCV): string {
  const n = c.matchsVerifies;
  const base = `${n} match${n > 1 ? "s" : ""} vérifié${n > 1 ? "s" : ""}`;
  return c.matchsSansPoints > 0 ? `${base} ${plusSansPoints(c.matchsSansPoints)}` : base;
}
