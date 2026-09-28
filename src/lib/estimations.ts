import { probabiliteVictoire } from "@/lib/glicko2";
import { RATING_INITIAL, RD_INITIAL } from "@/lib/classement";

// Chances estimées avant un match et « exploits » (28/09/2026, audit N10).
// Estimations d'après les ratings Glicko-2 au début du tournoi : affichées
// comme telles, jamais comme un résultat (CLAUDE.md §4).

export interface EtatRating {
  rating: number;
  rd: number;
}

/** Joueur sans rating : le rating et l'incertitude de départ de tous. */
export const ETAT_DE_DEPART: EtatRating = { rating: RATING_INITIAL, rd: RD_INITIAL };

/** En dessous de 35 % de chances, une victoire vérifiée est un exploit. */
export const SEUIL_EXPLOIT = 0.35;

/** Pourcentages entiers des deux joueurs, qui font toujours 100 à eux deux. */
export function pourcentages(a: EtatRating, b: EtatRating): [number, number] {
  const pa = Math.round(probabiliteVictoire(a, b) * 100);
  return [pa, 100 - pa];
}

/** Chances qu'avait le vainqueur avant le match, si c'est un exploit (sinon null). */
export function chancesSiExploit(vainqueur: EtatRating, perdant: EtatRating): number | null {
  const p = probabiliteVictoire(vainqueur, perdant);
  return p < SEUIL_EXPLOIT ? Math.round(p * 100) : null;
}
