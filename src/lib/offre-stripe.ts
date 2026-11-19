import type { Offre } from "@/lib/offres";

// Offre accordée par un abonnement Stripe (contrôle de sécurité du
// 19/11/2026) : déduite du prix réellement facturé, jamais des
// métadonnées de l'abonnement. Celles-ci gardent l'offre choisie au
// départ : un abonné passé d'Organisateur à Plus dans le portail Stripe
// aurait gardé Organisateur en ne payant que Plus.

export type OffrePayante = Exclude<Offre, "gratuit">;

/** Identifiants de prix Stripe de chaque offre (variables d'environnement). */
export function prixParOffre(): Record<OffrePayante, string | undefined> {
  return {
    verifie: process.env.STRIPE_PRICE_VERIFIE,
    elite: process.env.STRIPE_PRICE_ELITE,
    organisateur: process.env.STRIPE_PRICE_ORGANISATEUR,
  };
}

/** Offre correspondant à un prix Stripe, ou null si ce prix n'est celui d'aucune offre. */
export function offreDepuisPrix(
  prixId: string | null | undefined,
  prix: Record<OffrePayante, string | undefined>,
): OffrePayante | null {
  if (!prixId) return null;
  const trouvee = (Object.entries(prix) as [OffrePayante, string | undefined][]).find(([, id]) => id && id === prixId);
  return trouvee ? trouvee[0] : null;
}
