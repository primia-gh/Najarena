// Moteur de classement Glicko-2 (Glickman, 2013). Traduction fidèle — pas
// un portage ligne à ligne — de docs/glicko2.py, qui sert uniquement de
// référence de calibration (voir docs/sim.py). Les constantes ci-dessous
// sont celles retenues dans CLAUDE.md §4 après simulation, pas des valeurs
// par défaut de la librairie.

export const GLICKO_SCALE = 173.7178;
export const GLICKO_BASE = 1500;
export const TAU = 0.5; // volatilité du système, calibrée par simulation
export const RD_MAX = 350; // = RD initial : un joueur ne redevient jamais "plus incertain" qu'au départ
export const VOLATILITE_INITIALE = 0.06;

const EPS = 1e-6;

export interface EtatGlicko {
  rating: number;
  rd: number;
  volatilite: number;
}

export interface ResultatMatch {
  /** État de l'adversaire en DÉBUT de période (jamais son état courant). */
  adversaire: EtatGlicko;
  /** 1 = victoire, 0 = défaite, 0.5 = nul (inutilisé en 1v1 sans égalité). */
  score: 0 | 0.5 | 1;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu: number, muAdversaire: number, phiAdversaire: number): number {
  return 1 / (1 + Math.exp(-g(phiAdversaire) * (mu - muAdversaire)));
}

/**
 * Met à jour l'état d'un joueur pour UNE période de notation (= un tournoi,
 * cf. CLAUDE.md §4 — jamais match par match). `resultats` doit déjà avoir
 * exclu les matchs qui ne comptent pas (verdict manuel, forfait, plafond
 * anti-abus, tournoi non classé) : cette fonction ne fait aucun tri, elle
 * applique l'algorithme sur ce qu'on lui donne.
 */
export function mettreAJourJoueur(
  etat: EtatGlicko,
  resultats: ResultatMatch[],
  tau: number = TAU,
): EtatGlicko {
  const mu = (etat.rating - GLICKO_BASE) / GLICKO_SCALE;
  const phi = etat.rd / GLICKO_SCALE;
  const sigma = etat.volatilite;

  if (resultats.length === 0) {
    // Aucun match dans la période : l'incertitude remonte, le rating ne
    // bouge pas (CLAUDE.md §4 — "Inactivité").
    const phiEtoile = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: etat.rating,
      rd: Math.min(phiEtoile * GLICKO_SCALE, RD_MAX),
      volatilite: sigma,
    };
  }

  let vInv = 0;
  let sommeDelta = 0;
  for (const { adversaire, score } of resultats) {
    const muAdv = (adversaire.rating - GLICKO_BASE) / GLICKO_SCALE;
    const phiAdv = adversaire.rd / GLICKO_SCALE;
    const gj = g(phiAdv);
    const Ej = E(mu, muAdv, phiAdv);
    vInv += gj * gj * Ej * (1 - Ej);
    sommeDelta += gj * (score - Ej);
  }
  const v = 1 / vInv;
  const delta = v * sommeDelta;

  // Convergence de la nouvelle volatilité par la méthode d'Illinois.
  const a = Math.log(sigma * sigma);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) ** 2;
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  const sigmaNouveau = Math.exp(A / 2);
  const phiEtoile = Math.sqrt(phi * phi + sigmaNouveau * sigmaNouveau);
  const phiNouveau = 1 / Math.sqrt(1 / (phiEtoile * phiEtoile) + 1 / v);
  const muNouveau = mu + phiNouveau * phiNouveau * sommeDelta;

  return {
    rating: muNouveau * GLICKO_SCALE + GLICKO_BASE,
    rd: phiNouveau * GLICKO_SCALE,
    volatilite: sigmaNouveau,
  };
}

/**
 * Soft reset de saison (CLAUDE.md §4) : rapproche le rating de 1500 de 15%,
 * multiplie le RD par 1.8 (plafonné à RD_MAX). Jamais de remise à zéro.
 * N'est PAS appelé automatiquement — à invoquer lors d'une future rotation
 * de saison (Phase 2+, aucune saison n'existe encore).
 */
export function softResetSaison(etat: EtatGlicko): EtatGlicko {
  return {
    rating: etat.rating + 0.15 * (GLICKO_BASE - etat.rating),
    rd: Math.min(RD_MAX, etat.rd * 1.8),
    volatilite: etat.volatilite,
  };
}
