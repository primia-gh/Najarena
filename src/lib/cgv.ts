// Conditions générales de vente des offres payantes (19/11/2026, audit
// E11). Version enregistrée avec chaque souscription (métadonnées de
// l'abonnement Stripe), avec l'accord pour un accès immédiat : changer la
// version à chaque modification de /cgv.
export const VERSION_CGV = "2026-11-19";
export const DATE_CGV_LISIBLE = "19 novembre 2026";

/** Délai légal de rétractation (Code de la consommation, art. L221-18). */
export const DELAI_RETRACTATION_JOURS = 14;

/** Le paiement est-il branché ? (clé secrète Stripe présente sur le serveur) */
export function paiementActif(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const VARIABLE_PRIX: Record<string, string> = {
  verifie: "STRIPE_PRICE_VERIFIE",
  elite: "STRIPE_PRICE_ELITE",
  organisateur: "STRIPE_PRICE_ORGANISATEUR",
};

/** Cette offre peut-elle être achetée ? (clé Stripe et prix de l'offre réglés) */
export function offreEnVente(offre: string): boolean {
  const variable = VARIABLE_PRIX[offre];
  return paiementActif() && Boolean(variable && process.env[variable]?.split(",").some((p) => p.trim()));
}

/**
 * Prix lisible d'un montant Stripe en centimes d'euro : « 3,99 € ».
 * Espaces insécables, comme dans le reste du site.
 */
export function formaterPrixEuros(centimes: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
    .format(centimes / 100)
    .replace(/ /g, " ");
}

/** « /mois », « /an » — période d'un prix récurrent Stripe, sinon nulle. */
export function periodePrix(intervalle: string, nombre: number): string | null {
  if (nombre !== 1) return null;
  if (intervalle === "month") return "/mois";
  if (intervalle === "year") return "/an";
  return null;
}

/**
 * Médiateur de la consommation (Code de la consommation, art. L612-1) :
 * obligatoire avant de vendre à des particuliers. À renseigner (nom et
 * site) avant d'allumer les paiements ; tant qu'il est nul, /cgv l'annonce
 * comme « en cours de désignation ».
 */
export const MEDIATEUR: { nom: string; site: string } | null = null;
