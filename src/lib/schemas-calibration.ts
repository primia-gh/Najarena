import { RD_INITIAL, RD_SEUIL_CLASSEMENT } from "@/lib/classement";

// Courbe d'ILLUSTRATION du schéma « L'incertitude qui fond »
// (components/schemas/Schemas.tsx) : le RD part de RD_INITIAL et passe au
// seuil d'entrée au classement vers le 10e match (« une dizaine de
// matchs », CLAUDE.md §4). Ce n'est pas le calcul Glicko-2 : seulement la
// forme de la règle. Le test (schemas-calibration.test.ts) échoue si les
// constantes du classement changent sans que l'illustration suive.

export const RD_MAX_ILLUSTRATION = 400;
export const MATCHS_ILLUSTRATION = 14;
export const MATCH_SEUIL_ILLUSTRATION = 10;
export const PLANCHER_ILLUSTRATION = 70;

const PENTE =
  MATCH_SEUIL_ILLUSTRATION /
  Math.log((RD_INITIAL - PLANCHER_ILLUSTRATION) / (RD_SEUIL_CLASSEMENT - PLANCHER_ILLUSTRATION));

/** RD illustratif après m matchs vérifiés. */
export function rdIllustration(m: number): number {
  return PLANCHER_ILLUSTRATION + (RD_INITIAL - PLANCHER_ILLUSTRATION) * Math.exp(-m / PENTE);
}
