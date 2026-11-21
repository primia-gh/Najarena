import type { Offre } from "@/lib/offres";

// Offre accordée par un abonnement Stripe (contrôle de sécurité du
// 19/11/2026) : déduite du prix réellement facturé, jamais des
// métadonnées de l'abonnement. Celles-ci gardent l'offre choisie au
// départ : un abonné passé d'Organisateur à Plus dans le portail Stripe
// aurait gardé Organisateur en ne payant que Plus.
//
// Un prix Stripe ne se modifie pas : changer un tarif, c'est créer un
// nouveau prix, et les anciens abonnés restent sur l'ancien. Chaque
// variable STRIPE_PRICE_* peut donc lister plusieurs prix séparés par des
// virgules : le premier sert aux nouvelles souscriptions, tous sont
// reconnus pour les abonnés en cours.

export type OffrePayante = Exclude<Offre, "gratuit">;

/** Valeur brute des variables STRIPE_PRICE_* de chaque offre. */
export function prixParOffre(): Record<OffrePayante, string | undefined> {
  return {
    verifie: process.env.STRIPE_PRICE_VERIFIE,
    elite: process.env.STRIPE_PRICE_ELITE,
    organisateur: process.env.STRIPE_PRICE_ORGANISATEUR,
  };
}

/** Identifiants d'une variable « price_a, price_b », sans vide. */
export function listePrix(valeur: string | undefined): string[] {
  return (valeur ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Prix des nouvelles souscriptions : le premier de la liste. */
export function prixCourant(valeur: string | undefined): string | undefined {
  return listePrix(valeur)[0];
}

/** Offre correspondant à un prix Stripe, ou null si ce prix n'est celui d'aucune offre. */
export function offreDepuisPrix(
  prixId: string | null | undefined,
  prix: Record<OffrePayante, string | undefined>,
): OffrePayante | null {
  if (!prixId) return null;
  const trouvee = (Object.entries(prix) as [OffrePayante, string | undefined][]).find(([, valeur]) =>
    listePrix(valeur).includes(prixId),
  );
  return trouvee ? trouvee[0] : null;
}
