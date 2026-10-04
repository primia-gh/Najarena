"use server";

// Abonnements Stripe — scaffoldé en attendant les identifiants réels
// (produits/prix pas encore créés côté porteur du projet). Même repli
// gracieux que Resend/VAPID (src/lib/notifications.ts) : sans clé, la
// fonctionnalité se désactive proprement plutôt que de planter, pour que
// ce code puisse être mergé avant que Stripe soit prêt.

import { redirect } from "next/navigation";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { URL_SITE } from "@/lib/notifications";
import type { Offre } from "@/lib/offres";

const cleSecrete = process.env.STRIPE_SECRET_KEY;
const stripe = cleSecrete ? new Stripe(cleSecrete) : null;

const PRIX_PAR_OFFRE: Record<Exclude<Offre, "gratuit">, string | undefined> = {
  verifie: process.env.STRIPE_PRICE_VERIFIE,
  elite: process.env.STRIPE_PRICE_ELITE,
  organisateur: process.env.STRIPE_PRICE_ORGANISATEUR,
};

export async function demarrerAbonnement(formData: FormData) {
  const offre = String(formData.get("offre") ?? "") as Offre;

  if (offre === "gratuit" || !(offre in PRIX_PAR_OFFRE)) {
    redirect(`/tarifs?erreur=${encodeURIComponent("Offre invalide.")}`);
  }

  if (!stripe) {
    redirect(
      `/tarifs?erreur=${encodeURIComponent("Le paiement n'est pas encore activé — reviens bientôt.")}`,
    );
  }

  const prixId = PRIX_PAR_OFFRE[offre as Exclude<Offre, "gratuit">];
  if (!prixId) {
    redirect(
      `/tarifs?erreur=${encodeURIComponent("Ce palier n'est pas encore configuré côté paiement.")}`,
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/connexion?next=${encodeURIComponent("/tarifs")}`);
  }

  // Client Stripe déjà connu (ancien abonnement) : réutilisé, pour que
  // factures et moyens de paiement restent au même endroit.
  const clientExistant = await clientStripe(userData.user.id);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: prixId, quantity: 1 }],
    // profile_id/offre portés par la session ET par l'abonnement lui-même
    // (subscription_data.metadata) — le webhook reçoit l'objet Subscription,
    // pas la Session, sur les événements update/delete qui suivent le
    // paiement initial ; sans ça, ces événements ne sauraient pas à quel
    // compte Najarena ils correspondent.
    client_reference_id: userData.user.id,
    ...(clientExistant ? { customer: clientExistant } : { customer_email: userData.user.email ?? undefined }),
    success_url: `${URL_SITE}/moi?message=${encodeURIComponent("Abonnement en cours de confirmation.")}`,
    cancel_url: `${URL_SITE}/tarifs`,
    metadata: { profile_id: userData.user.id, offre },
    subscription_data: { metadata: { profile_id: userData.user.id, offre } },
  });

  if (!session.url) {
    redirect(`/tarifs?erreur=${encodeURIComponent("Impossible de démarrer le paiement pour l'instant.")}`);
  }

  redirect(session.url);
}

async function clientStripe(profileId: string): Promise<string | null> {
  const admin = creerClientAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("abonnements_stripe")
    .select("client_stripe_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data?.client_stripe_id ?? null;
}

// Portail client Stripe (28/09/2026) : moyen de paiement, factures,
// changement d'offre et résiliation, sans passer par un e-mail. Le contenu
// du portail se règle dans le tableau de bord Stripe (Settings > Billing >
// Customer portal).
export async function ouvrirPortailAbonnement() {
  if (!stripe) {
    redirect(`/moi?erreur=${encodeURIComponent("Le paiement n'est pas encore activé.")}`);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const clientId = await clientStripe(userData.user.id);
  if (!clientId) {
    redirect(`/moi?erreur=${encodeURIComponent("Aucun abonnement Stripe n'est rattaché à ton compte.")}`);
  }

  let url: string | null = null;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: clientId,
      return_url: `${URL_SITE}/moi`,
    });
    url = session.url;
  } catch {
    url = null;
  }
  if (!url) {
    redirect(`/moi?erreur=${encodeURIComponent("Le portail d'abonnement est indisponible pour l'instant.")}`);
  }
  redirect(url);
}
