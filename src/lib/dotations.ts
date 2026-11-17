// Cash prizes sponsorisés (03/10/2026, audit N32) — désactivés tant que
// CASH_PRIZES_ACTIFS n'est pas à « 1 » côté serveur. Préalables à
// l'activation : statut juridique de l'éditeur (audit E11), CGU relues par
// un juriste, règles Riot sur les tournois dotés vérifiées. Le site ne fait
// transiter aucun argent : il affiche la dotation, désigne les gagnants
// d'après le bracket et garde la trace des versements faits hors du site.

/** Interrupteur serveur, éteint par défaut. */
export function cashPrizesActifs(): boolean {
  return process.env.CASH_PRIZES_ACTIFS === "1";
}

export const LIBELLE_RANG: Record<number, string> = {
  1: "Vainqueur",
  2: "Finaliste",
  3: "Demi-finalistes (chacun)",
  4: "Quarts de finalistes (chacun)",
};

export function formaterEuros(centimes: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: centimes % 100 === 0 ? 0 : 2,
  }).format(centimes / 100);
}

/**
 * « 100, 50, 25 » (euros par rang : vainqueur, finaliste, demi-finalistes,
 * quarts) → montants en centimes ; nul si la saisie est invalide.
 */
export function lireRepartition(saisie: string): number[] | null {
  const morceaux = saisie
    .split(/[;,]/)
    .map((m) => m.trim().replace(/\s|€/g, ""))
    .filter((m) => m.length > 0);
  if (morceaux.length < 1 || morceaux.length > 4) return null;
  const centimes = morceaux.map((m) => (/^\d+(\.\d{1,2})?$/.test(m) ? Math.round(Number(m) * 100) : NaN));
  return centimes.every((c) => Number.isInteger(c) && c > 0) ? centimes : null;
}

const MESSAGES_REFUS: Record<string, string> = {
  ADMIN_REQUIS: "Réservé aux administrateurs.",
  TOURNOI_INTROUVABLE: "Tournoi introuvable.",
  DOTATION_FORMAT: "Dotation possible seulement sur un tournoi 1v1 (pas un défi, un scrim ni un 5v5).",
  DOTATION_TROP_TARD: "Une dotation s'annonce avant la fin des inscriptions (tournoi en brouillon ou ouvert).",
  NOM_INTERDIT: "Nom de sponsor refusé par la modération.",
  DOTATION_INTROUVABLE: "Aucune dotation active sur ce tournoi.",
  TOURNOI_PAS_TERMINE: "Les gagnants se désignent une fois le tournoi terminé.",
  DOTATION_DEJA_VERSEE: "Une partie de la dotation est déjà versée : impossible de l'annuler.",
  // Versement par Stripe Connect (04/10/2026).
  VERSEMENT_INTROUVABLE: "Ce gain n'existe pas (ou sa dotation est annulée).",
  VERSEMENT_DEJA_TRAITE: "Ce gain est déjà versé ou refusé.",
  RANG_A_VERIFIER: "Ce rang a été décidé à la main : coche « rang vérifié » après l'avoir contrôlé.",
  IDENTITE_NON_VERIFIEE: "Le gagnant n'a pas encore fait vérifier son identité par Stripe.",
  COMPTE_SUSPENDU: "Le compte du gagnant est suspendu.",
  VIREMENT_STRIPE_FAIT: "Ce gain a été versé par Stripe : il ne se modifie plus à la main.",
  AUCUN_GAIN: "Aucun gain à recevoir pour l'instant.",
  dotations_repartition_check: "Répartition invalide : 1 à 4 montants positifs.",
  dotations_sponsor_lien_check: "Le lien du sponsor doit commencer par https://.",
  dotations_sponsor_nom_check: "Nom du sponsor : 2 à 60 caractères.",
};

export function messageRefusDotation(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS[code] : parDefaut;
}
