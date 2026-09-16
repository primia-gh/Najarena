// Webhook Stripe — source de vérité pour comptes_offres une fois Stripe
// activé (voir src/lib/stripe-actions.ts). Écrit exclusivement via le
// client service_role, jamais via le client RLS : comptes_offres n'a
// aucune policy client, par construction (voir la migration).
//
// Sans STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET, répond 503 plutôt que de
// planter — ce fichier peut être mergé avant que Stripe soit configuré.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { creerClientAdmin } from "@/lib/supabase/admin";
import type { Offre } from "@/lib/offres";

const cleSecrete = process.env.STRIPE_SECRET_KEY;
const stripe = cleSecrete ? new Stripe(cleSecrete) : null;
const secretWebhook = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!stripe || !secretWebhook) {
    return NextResponse.json({ erreur: "Stripe pas encore activé." }, { status: 503 });
  }

  const corpsBrut = await request.text();
  const signature = request.headers.get("stripe-signature");

  let evenement: Stripe.Event;
  try {
    evenement = stripe.webhooks.constructEvent(corpsBrut, signature ?? "", secretWebhook);
  } catch {
    return NextResponse.json({ erreur: "Signature invalide." }, { status: 400 });
  }

  const admin = creerClientAdmin();
  if (!admin) {
    // SUPABASE_SERVICE_ROLE_KEY manquante — configuration incomplète, mais
    // on renvoie 200 pour que Stripe ne s'acharne pas à retenter un
    // événement qui échouera de la même façon indéfiniment ; l'incident
    // reste visible dans les logs Vercel/Stripe.
    console.error("Webhook Stripe : SUPABASE_SERVICE_ROLE_KEY manquante.");
    return NextResponse.json({ recu: true });
  }

  switch (evenement.type) {
    case "checkout.session.completed": {
      const session = evenement.data.object as Stripe.Checkout.Session;
      const profileId = session.client_reference_id ?? session.metadata?.profile_id;
      const offre = session.metadata?.offre as Offre | undefined;
      if (profileId && offre && offre !== "gratuit") {
        await admin.from("comptes_offres").upsert({
          profile_id: profileId,
          offre,
          attribue_le: new Date().toISOString(),
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const abonnement = evenement.data.object as Stripe.Subscription;
      const profileId = abonnement.metadata?.profile_id;
      const offre = abonnement.metadata?.offre as Offre | undefined;
      if (profileId && offre && offre !== "gratuit") {
        if (abonnement.status === "active" || abonnement.status === "trialing") {
          await admin.from("comptes_offres").upsert({
            profile_id: profileId,
            offre,
            attribue_le: new Date().toISOString(),
          });
        } else {
          // Paiement échoué, abonnement en pause, etc. — on retire l'offre
          // plutôt que de la laisser active sans paiement en cours.
          await admin.from("comptes_offres").delete().eq("profile_id", profileId);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const abonnement = evenement.data.object as Stripe.Subscription;
      const profileId = abonnement.metadata?.profile_id;
      if (profileId) {
        await admin.from("comptes_offres").delete().eq("profile_id", profileId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ recu: true });
}
