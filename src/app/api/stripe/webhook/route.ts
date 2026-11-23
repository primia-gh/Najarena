// Webhook Stripe — source de vérité pour comptes_offres une fois Stripe
// activé (voir src/lib/stripe-actions.ts). Écrit exclusivement via le
// client service_role, jamais via le client RLS : comptes_offres n'a
// aucune policy client, par construction (voir la migration). Traitement
// d'un abonnement commun avec la vérification quotidienne :
// src/lib/abonnements-stripe-serveur.ts.
//
// Sans STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET, répond 503 plutôt que de
// planter — ce fichier peut être mergé avant que Stripe soit configuré.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { compteStripeVerifie } from "@/lib/versements-stripe";
import { joueurDeLAbonnement } from "@/lib/offre-stripe";
import { appliquerAbonnement, relireAbonnement } from "@/lib/abonnements-stripe-serveur";

const cleSecrete = process.env.STRIPE_SECRET_KEY;
const stripe = cleSecrete ? new Stripe(cleSecrete) : null;
const secretWebhook = process.env.STRIPE_WEBHOOK_SECRET;
// Comptes de versement des cash prizes (audit N32) : les événements des
// comptes Connect arrivent par un point d'écoute « Connect », qui a son
// propre secret de signature chez Stripe.
const secretWebhookConnect = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

const A_RENVOYER = () => NextResponse.json({ erreur: "Écriture impossible pour l'instant, à renvoyer." }, { status: 503 });

export async function POST(request: Request) {
  if (!stripe || !secretWebhook) {
    return NextResponse.json({ erreur: "Stripe pas encore activé." }, { status: 503 });
  }

  const corpsBrut = await request.text();
  const signature = request.headers.get("stripe-signature");

  // Quel secret a signé l'événement : chacun n'ouvre que ses propres
  // événements (contrôle de sécurité du 17/10/2026). Le secret Connect ne
  // sert qu'à la vérification des comptes de versement, jamais aux
  // abonnements ; le secret principal ne touche pas aux comptes Connect.
  const verifier = (secret: string | undefined): Stripe.Event | null => {
    if (!secret) return null;
    try {
      return stripe.webhooks.constructEvent(corpsBrut, signature ?? "", secret);
    } catch {
      return null;
    }
  };
  const principal = verifier(secretWebhook);
  const connect = principal ? null : verifier(secretWebhookConnect);
  const evenement = principal ?? connect;
  if (!evenement) {
    return NextResponse.json({ erreur: "Signature invalide." }, { status: 400 });
  }
  // Un événement d'un compte connecté (evenement.account) n'est jamais un
  // abonnement : seul le secret Connect l'ouvre.
  const evenementAdmis = principal
    ? evenement.type !== "account.updated" && !evenement.account
    : evenement.type === "account.updated" && Boolean(evenement.account);
  if (!evenementAdmis) {
    // Reçu mais ignoré : Stripe n'a pas à le renvoyer.
    return NextResponse.json({ recu: true });
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
      const abonnementId =
        typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
      // Nos paiements sont toujours des abonnements : l'offre suit l'état
      // relu de l'abonnement (un paiement différé ne l'accorde pas encore ;
      // customer.subscription.updated le fera une fois payé).
      if (!abonnementId) break;
      const abonnement = await relireAbonnement(stripe, abonnementId);
      if (!abonnement) return A_RENVOYER();
      // Le compte servi est celui que notre serveur a étiqueté sur
      // l'abonnement, le même qui sert à la résiliation : un abonnement
      // créé hors du site n'accorde rien (joueurDeLAbonnement).
      const profileId = joueurDeLAbonnement(abonnement.metadata?.profile_id, session.client_reference_id);
      if (!profileId) break;
      if ((await appliquerAbonnement(stripe, admin, profileId, abonnement)) === "echec") return A_RENVOYER();
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const recu = evenement.data.object as Stripe.Subscription;
      const abonnement = await relireAbonnement(stripe, recu.id);
      if (!abonnement) return A_RENVOYER();
      const profileId = joueurDeLAbonnement(abonnement.metadata?.profile_id);
      if (profileId && (await appliquerAbonnement(stripe, admin, profileId, abonnement)) === "echec") return A_RENVOYER();
      break;
    }

    // Compte de versement d'un gagnant : identité vérifiée (ou plus) par
    // Stripe. Relire deux fois le même état ne change rien.
    case "account.updated": {
      const compte = evenement.data.object as Stripe.Account;
      const { error } = await admin.rpc("maj_compte_versement", {
        p_stripe_compte_id: compte.id,
        p_verifie: compteStripeVerifie(compte),
      });
      if (error) return A_RENVOYER();
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ recu: true });
}
