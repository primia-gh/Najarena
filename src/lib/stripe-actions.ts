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
import { RETOURS_EXTERNES } from "@/lib/messages-adresse";
import { DELAI_RETRACTATION_JOURS, paiementActif, VERSION_CGV } from "@/lib/cgv";
import { abonnementEnVie, prixCourant } from "@/lib/offre-stripe";

const cleSecrete = process.env.STRIPE_SECRET_KEY;
const stripe = cleSecrete ? new Stripe(cleSecrete) : null;

const PRIX_PAR_OFFRE: Record<Exclude<Offre, "gratuit">, string | undefined> = {
  verifie: prixCourant(process.env.STRIPE_PRICE_VERIFIE),
  elite: prixCourant(process.env.STRIPE_PRICE_ELITE),
  organisateur: prixCourant(process.env.STRIPE_PRICE_ORGANISATEUR),
};

export async function demarrerAbonnement(formData: FormData) {
  const offre = String(formData.get("offre") ?? "") as Offre;

  // Object.hasOwn : « constructor », « toString »… ne passent pas pour une offre.
  if (offre === "gratuit" || !Object.hasOwn(PRIX_PAR_OFFRE, offre)) {
    redirect(`/tarifs?erreur=${encodeURIComponent("Offre invalide.")}#retour`);
  }

  // CGV acceptées et accès immédiat demandé (audit E11) : sans cette case,
  // pas de paiement. L'accord est gardé dans l'abonnement Stripe (version
  // des CGV, date), preuve de ce que le client a accepté.
  if (formData.get("cgv") !== "on") {
    redirect(
      `/tarifs?erreur=${encodeURIComponent(
        "Coche la case : acceptation des CGV et accès immédiat à l'offre (tu gardes 14 jours pour te rétracter).",
      )}#retour`,
    );
  }

  // Ventes fermées tant que la clé Stripe ou le médiateur manque (paiementActif).
  if (!stripe || !paiementActif()) {
    redirect(
      `/tarifs?erreur=${encodeURIComponent("Le paiement n'est pas encore activé — reviens bientôt.")}#retour`,
    );
  }

  const prixId = PRIX_PAR_OFFRE[offre as Exclude<Offre, "gratuit">];
  if (!prixId) {
    redirect(
      `/tarifs?erreur=${encodeURIComponent("Ce palier n'est pas encore configuré côté paiement.")}#retour`,
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

  // Un seul abonnement à la fois (contrôle de sécurité du 22/11/2026) : un
  // second payait en double, et la fin de l'un pouvait retirer l'offre
  // payée par l'autre. Changer de formule passe par le portail Stripe.
  const dejaAbonne = clientExistant ? await abonnementDejaEnVie(clientExistant) : "non";
  if (dejaAbonne === "oui") {
    redirect(
      `/tarifs?erreur=${encodeURIComponent(
        "Tu as déjà un abonnement : change de formule ou résilie-le depuis « Gérer ou résilier mon abonnement », dans ton tableau de bord.",
      )}#retour`,
    );
  }
  if (dejaAbonne === "inconnu") {
    redirect(`/tarifs?erreur=${encodeURIComponent("Impossible de démarrer le paiement pour l'instant.")}#retour`);
  }

  const accord = { cgv_version: VERSION_CGV, cgv_acceptees_le: new Date().toISOString(), acces_immediat: "oui" };

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
    success_url: `${URL_SITE}/moi?message=${encodeURIComponent(RETOURS_EXTERNES.abonnementEnCours)}`,
    cancel_url: `${URL_SITE}/tarifs`,
    metadata: { profile_id: userData.user.id, offre, ...accord },
    subscription_data: { metadata: { profile_id: userData.user.id, offre, ...accord } },
    custom_text: {
      submit: {
        message: `En t'abonnant, tu acceptes les conditions générales de vente de Najarena (${URL_SITE}/cgv) et tu demandes l'accès immédiat à ton offre. Tu gardes ${DELAI_RETRACTATION_JOURS} jours pour te rétracter, et tu résilies en ligne à tout moment depuis ton tableau de bord.`,
      },
    },
  });

  if (!session.url) {
    redirect(`/tarifs?erreur=${encodeURIComponent("Impossible de démarrer le paiement pour l'instant.")}#retour`);
  }

  redirect(session.url);
}

// Ce client Stripe a-t-il un abonnement qui n'a pas pris fin ? « inconnu »
// si Stripe ne répond pas : on ne démarre pas de paiement à l'aveugle.
async function abonnementDejaEnVie(clientId: string): Promise<"oui" | "non" | "inconnu"> {
  if (!stripe) return "inconnu";
  try {
    const liste = await stripe.subscriptions.list({ customer: clientId, status: "all", limit: 20 });
    return liste.data.some((a) => abonnementEnVie(a.status)) ? "oui" : "non";
  } catch {
    return "inconnu";
  }
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
