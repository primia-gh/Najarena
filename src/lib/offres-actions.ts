"use server";

import { redirect } from "next/navigation";
import { messageModeration } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { ORDRE_OFFRE, type Offre } from "@/lib/offres";
import { lienExterneSur, MESSAGE_LIEN_INVALIDE } from "@/lib/lien-externe";
import Stripe from "stripe";
import { abonnementEnVie, joueurDeLAbonnement } from "@/lib/offre-stripe";

// Un abonnement Stripe encore en vie pour ce joueur, lu chez Stripe même si
// la base ne le connaît pas (message de paiement perdu, contrôle de sécurité
// du 23/11/2026). « inconnu » si Stripe ne peut pas répondre.
async function abonneChezStripe(clientId: string, profileId: string): Promise<"oui" | "non" | "inconnu"> {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) return "inconnu";
  try {
    const stripe = new Stripe(cle, { timeout: 10_000, maxNetworkRetries: 1 });
    const liste = await stripe.subscriptions.list({ customer: clientId, status: "all", limit: 100 });
    return liste.data.some(
      (a) => joueurDeLAbonnement(a.metadata?.profile_id) === profileId && abonnementEnVie(a.status),
    )
      ? "oui"
      : "non";
  } catch {
    return "inconnu";
  }
}

async function verifierAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/moi");
  }

  return userData.user;
}

// Seule voie d'écriture manuelle sur comptes_offres — comptes_offres n'a
// aucune policy client (voir la migration), donc même un admin passe par
// le client service_role, jamais par le client RLS normal. C'est la même
// table que le futur webhook Stripe écrira ; les deux écrivains sont
// server_role, jamais le navigateur.
export async function attribuerOffreAdmin(formData: FormData) {
  const supabase = await createClient();
  const utilisateur = await verifierAdmin(supabase);

  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const offre = String(formData.get("offre") ?? "gratuit") as Offre;

  if (offre !== "gratuit" && !["verifie", "elite", "organisateur"].includes(offre)) {
    redirect(`/admin?erreur=${encodeURIComponent("Offre invalide.")}`);
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("id")
    .eq("pseudo", pseudo)
    .maybeSingle();

  if (!profil) {
    redirect(`/admin?erreur=${encodeURIComponent(`Aucun joueur avec le pseudo « ${pseudo} ».`)}`);
  }

  const admin = creerClientAdmin();
  if (!admin) {
    redirect(
      `/admin?erreur=${encodeURIComponent("Attribution indisponible (SUPABASE_SERVICE_ROLE_KEY manquante).")}`,
    );
  }

  // Joueur abonné chez Stripe (contrôle de sécurité du 23/11/2026) : son
  // offre suit son abonnement. Une offre donnée ici n'est jamais retirée par
  // la fin d'un abonnement (elle resterait à vie après un remboursement), et
  // une révocation serait défaite par la vérification quotidienne. On passe
  // donc par Stripe.
  const { data: abonnement, error: erreurAbonnement } = await admin
    .from("abonnements_stripe")
    .select("statut, client_stripe_id")
    .eq("profile_id", profil.id)
    .maybeSingle();
  if (erreurAbonnement) {
    redirect(
      `/admin?erreur=${encodeURIComponent(`Impossible de lire l'abonnement de ${pseudo} dans la base pour l'instant : réessaie dans quelques minutes.`)}`,
    );
  }
  // Client Stripe connu : on demande à Stripe lui-même (la base peut ignorer
  // un abonnement dont le message de paiement s'est perdu).
  const chezStripe = abonnement?.client_stripe_id ? await abonneChezStripe(abonnement.client_stripe_id, profil.id) : "non";
  if (chezStripe === "inconnu") {
    redirect(
      `/admin?erreur=${encodeURIComponent(
        `Impossible de vérifier l'abonnement Stripe de ${pseudo} : Stripe ne répond pas, réessaie dans quelques minutes.`,
      )}`,
    );
  }
  if ((abonnement?.statut && abonnementEnVie(abonnement.statut)) || chezStripe === "oui") {
    redirect(
      `/admin?erreur=${encodeURIComponent(
        `${pseudo} a un abonnement Stripe en cours : son offre suit cet abonnement et ne se modifie pas ici. Pour la changer, modifie ou résilie l'abonnement dans Stripe (l'offre suivra).`,
      )}`,
    );
  }

  if (offre === "gratuit") {
    await admin.from("comptes_offres").delete().eq("profile_id", profil.id);
  } else {
    await admin.from("comptes_offres").upsert({
      profile_id: profil.id,
      offre,
      attribue_le: new Date().toISOString(),
      attribue_par: utilisateur.id,
    });
  }

  redirect("/admin?message=" + encodeURIComponent(`Offre mise à jour pour ${pseudo}.`));
}

// L'utilisateur modifie sa propre bio/lien externe — réservé à qui a au
// moins l'offre Plus. comptes_offres n'ayant aucune policy client,
// l'écriture passe elle aussi par le client admin, après vérification
// serveur de l'identité ET de l'offre (jamais une simple case cachée
// côté UI).
export async function mettreAJourBioProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: compte } = await supabase
    .from("comptes_offres")
    .select("offre")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!compte || ORDRE_OFFRE[compte.offre as Offre] < ORDRE_OFFRE.verifie) {
    redirect(`/moi?erreur=${encodeURIComponent("La personnalisation du profil demande l'offre Plus ou au-dessus.")}`);
  }

  // Retour sur le CV, au formulaire (relecture design du 12/10/2026 : sur
  // /moi, le joueur perdait son formulaire de vue).
  const { data: profil } = await supabase.from("profiles").select("slug").eq("id", userData.user.id).maybeSingle();
  const retour = (type: "message" | "erreur", texte: string): never =>
    redirect(
      profil?.slug
        ? `/joueur/${profil.slug}?${type}=${encodeURIComponent(texte)}#personnaliser`
        : `/moi?${type}=${encodeURIComponent(texte)}`,
    );

  const bio = String(formData.get("bio") ?? "").trim().slice(0, 140);
  // Adresse web complète seulement, sans message d'adresse (src/lib/lien-externe.ts).
  const lienSaisi = String(formData.get("lien_externe") ?? "").trim();
  const lienExterne = lienExterneSur(lienSaisi);
  // Bio et lien s'enregistrent ensemble : un refus le dit (relecture
  // design du 12/10/2026, la bio semblait perdue sans explication).
  if (lienSaisi && !lienExterne) {
    return retour("erreur", `Rien n'a été enregistré. ${MESSAGE_LIEN_INVALIDE}`);
  }

  const admin = creerClientAdmin();
  if (!admin) {
    return retour("erreur", "Mise à jour indisponible pour l'instant.");
  }

  const { error } = await admin
    .from("comptes_offres")
    .update({ bio: bio || null, lien_externe: lienExterne || null })
    .eq("profile_id", userData.user.id);
  if (error) {
    const refus = messageModeration(error.message);
    return retour("erreur", refus ? `Rien n'a été enregistré. ${refus}` : "Mise à jour indisponible pour l'instant.");
  }

  return retour("message", "Profil mis à jour.");
}
