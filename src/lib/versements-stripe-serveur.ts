import Stripe from "stripe";

// Client Stripe des versements (audit N32), côté serveur seulement. Sans
// STRIPE_SECRET_KEY, rien n'est possible : les pages le disent.

let client: Stripe | null = null;

export function clientStripe(): Stripe | null {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return null;
  client ??= new Stripe(cle);
  return client;
}
