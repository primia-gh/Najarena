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
import { compteStripeVerifie } from "@/lib/versements-stripe";

const cleSecrete = process.env.STRIPE_SECRET_KEY;
const stripe = cleSecrete ? new Stripe(cleSecrete) : null;
const secretWebhook = process.env.STRIPE_WEBHOOK_SECRET;
// Comptes de versement des cash prizes (audit N32) : les événements des
// comptes Connect arrivent par un point d'écoute « Connect », qui a son
// propre secret de signature chez Stripe.
const secretWebhookConnect = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

function identifiant(objet: string | { id: string } | null | undefined): string | null {
  if (!objet) return null;
  return typeof objet === "string" ? objet : objet.id;
}

// État de l'abonnement (active, past_due, canceled…), gardé pour le
// tableau de bord et la suppression de compte.
async function suivreAbonnement(admin: ClientAdmin, profileId: string, abonnement: Stripe.Subscription) {
  const clientId = identifiant(abonnement.customer);
  if (!clientId) return;
  await admin.from("abonnements_stripe").upsert({
    profile_id: profileId,
    client_stripe_id: clientId,
    abonnement_stripe_id: abonnement.id,
    statut: abonnement.status,
    maj_le: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  if (!stripe || !secretWebhook) {
    return NextResponse.json({ erreur: "Stripe pas encore activé." }, { status: 503 });
  }

  const corpsBrut = await request.text();
  const signature = request.headers.get("stripe-signature");

  const evenement = [secretWebhook, secretWebhookConnect].reduce<Stripe.Event | null>((trouve, secret) => {
    if (trouve || !secret) return trouve;
    try {
      return stripe.webhooks.constructEvent(corpsBrut, signature ?? "", secret);
    } catch {
      return null;
    }
  }, null);
  if (!evenement) {
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
      // Identifiant client : ouvre le portail Stripe (gérer, résilier) et
      // évite un second client Stripe à un nouvel abonnement.
      const clientId = identifiant(session.customer);
      if (profileId && clientId) {
        await admin.from("abonnements_stripe").upsert({
          profile_id: profileId,
          client_stripe_id: clientId,
          abonnement_stripe_id: identifiant(session.subscription),
          statut: "active",
          maj_le: new Date().toISOString(),
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const abonnement = evenement.data.object as Stripe.Subscription;
      const profileId = abonnement.metadata?.profile_id;
      const offre = abonnement.metadata?.offre as Offre | undefined;
      if (profileId) {
        await suivreAbonnement(admin, profileId, abonnement);
      }
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
        await suivreAbonnement(admin, profileId, abonnement);
      }
      break;
    }

    // Compte de versement d'un gagnant : identité vérifiée (ou plus) par
    // Stripe. Relire deux fois le même état ne change rien.
    case "account.updated": {
      const compte = evenement.data.object as Stripe.Account;
      await admin.rpc("maj_compte_versement", {
        p_stripe_compte_id: compte.id,
        p_verifie: compteStripeVerifie(compte),
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ recu: true });
}
