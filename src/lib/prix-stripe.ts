import Stripe from "stripe";
import { unstable_cache } from "next/cache";
import type { Offre } from "@/lib/offres";
import { formaterPrixEuros, periodePrix } from "@/lib/cgv";
import { prixCourant } from "@/lib/offre-stripe";

// Prix exacts des offres, lus chez Stripe (19/11/2026, audit E11) : la page
// Tarifs affiche le prix réellement facturé, toutes taxes comprises, plutôt
// qu'une fourchette. Gardés une heure en cache (un changement de prix chez
// Stripe apparaît dans l'heure). Sans clé Stripe, ou pour un prix hors
// taxes, mal réglé ou injoignable : rien, et la page garde ses prix
// indicatifs.

type OffrePayante = Exclude<Offre, "gratuit">;

export interface PrixOffre {
  montant: string;
  periode: string;
}

const PRIX_PAR_OFFRE: Record<OffrePayante, string | undefined> = {
  verifie: prixCourant(process.env.STRIPE_PRICE_VERIFIE),
  elite: prixCourant(process.env.STRIPE_PRICE_ELITE),
  organisateur: prixCourant(process.env.STRIPE_PRICE_ORGANISATEUR),
};

async function lirePrix(): Promise<Partial<Record<OffrePayante, PrixOffre>>> {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return {};
  const stripe = new Stripe(cle);
  const resultat: Partial<Record<OffrePayante, PrixOffre>> = {};
  await Promise.all(
    (Object.entries(PRIX_PAR_OFFRE) as [OffrePayante, string | undefined][]).map(async ([offre, id]) => {
      if (!id) return;
      try {
        const prix = await stripe.prices.retrieve(id);
        const periode = prix.recurring ? periodePrix(prix.recurring.interval, prix.recurring.interval_count) : null;
        // Un prix « hors taxes » n'est pas le prix payé par un particulier.
        if (prix.active && prix.currency === "eur" && prix.unit_amount !== null && periode && prix.tax_behavior !== "exclusive") {
          resultat[offre] = { montant: formaterPrixEuros(prix.unit_amount), periode };
        }
      } catch {
        // Prix introuvable ou Stripe injoignable : prix indicatif.
      }
    }),
  );
  return resultat;
}

export const prixOffres = unstable_cache(lirePrix, ["prix-offres-stripe-v1"], { revalidate: 3600 });
