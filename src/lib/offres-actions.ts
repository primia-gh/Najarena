"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { ORDRE_OFFRE, type Offre } from "@/lib/offres";

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
// moins l'offre Vérifié. comptes_offres n'ayant aucune policy client,
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
    redirect(`/moi?erreur=${encodeURIComponent("La personnalisation du profil demande l'offre Vérifié ou plus.")}`);
  }

  const bio = String(formData.get("bio") ?? "").trim().slice(0, 140);
  const lienExterne = String(formData.get("lien_externe") ?? "").trim().slice(0, 300);

  const admin = creerClientAdmin();
  if (!admin) {
    redirect(`/moi?erreur=${encodeURIComponent("Mise à jour indisponible pour l'instant.")}`);
  }

  await admin
    .from("comptes_offres")
    .update({ bio: bio || null, lien_externe: lienExterne || null })
    .eq("profile_id", userData.user.id);

  redirect("/moi?message=" + encodeURIComponent("Profil mis à jour."));
}
