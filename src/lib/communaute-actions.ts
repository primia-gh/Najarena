"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugifier } from "@/lib/slug";
import { COULEUR_COMMUNAUTE_DEFAUT, couleurValide, messageRefusCommunaute } from "@/lib/communautes";

// Espaces communauté (03/10/2026, audit N30). Toutes les règles (offre
// Organisateur, 3 communautés au plus, rôles, modération des textes) sont
// appliquées par la base ; ces actions appellent ses fonctions.

async function session() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  return { supabase, utilisateur: userData.user };
}

function versPage(slug: string, type: "message" | "erreur", texte: string, ancre = ""): never {
  redirect(`/communaute/${encodeURIComponent(slug)}?${type}=${encodeURIComponent(texte)}${ancre}`);
}

export async function creerCommunaute(formData: FormData) {
  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const couleurSaisie = String(formData.get("couleur") ?? "");
  const lienDiscord = String(formData.get("lien_discord") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion?suite=%2Fcommunaute%2Fnouvelle");

  const slug = `${slugifier(nom)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.rpc("creer_communaute", {
    p_nom: nom,
    p_slug: slug,
    p_description: description,
    p_couleur: couleurValide(couleurSaisie) ? couleurSaisie : COULEUR_COMMUNAUTE_DEFAUT,
    p_lien_discord: lienDiscord,
  });
  if (error) {
    redirect(
      `/communaute/nouvelle?erreur=${encodeURIComponent(messageRefusCommunaute(error.message, "Impossible de créer la communauté pour l'instant."))}`,
    );
  }
  versPage(slug, "message", "Communauté créée. Invite tes joueurs à la rejoindre depuis cette page.");
}

export async function modifierCommunaute(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const couleur = String(formData.get("couleur") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("modifier_communaute", {
    p_communaute_id: id,
    p_description: String(formData.get("description") ?? ""),
    p_couleur: couleurValide(couleur) ? couleur : COULEUR_COMMUNAUTE_DEFAUT,
    p_lien_discord: String(formData.get("lien_discord") ?? ""),
  });
  if (error)
    versPage(
      slug,
      "erreur",
      messageRefusCommunaute(error.message, "Modification impossible pour l'instant."),
      "#gestion",
    );
  revalidatePath(`/communaute/${slug}`);
  versPage(slug, "message", "Communauté mise à jour.", "#gestion");
}

export async function rejoindreCommunaute(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect(`/connexion?suite=${encodeURIComponent(`/communaute/${slug}`)}`);

  const { error } = await supabase.rpc("rejoindre_communaute", { p_communaute_id: id });
  if (error) versPage(slug, "erreur", messageRefusCommunaute(error.message, "Impossible de rejoindre pour l'instant."));
  revalidatePath(`/communaute/${slug}`);
  versPage(slug, "message", "Bienvenue dans la communauté.");
}

export async function quitterCommunaute(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("quitter_communaute", { p_communaute_id: id });
  if (error) versPage(slug, "erreur", messageRefusCommunaute(error.message, "Impossible de quitter pour l'instant."));
  revalidatePath(`/communaute/${slug}`);
  versPage(slug, "message", "Tu as quitté la communauté.");
}

export async function retirerMembreCommunaute(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const membre = String(formData.get("profile_id") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("retirer_membre_communaute", { p_communaute_id: id, p_profile_id: membre });
  if (error)
    versPage(slug, "erreur", messageRefusCommunaute(error.message, "Action impossible pour l'instant."), "#membres");
  revalidatePath(`/communaute/${slug}`);
  versPage(slug, "message", "Membre retiré.", "#membres");
}

export async function nommerAdminCommunaute(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const membre = String(formData.get("profile_id") ?? "");
  const admin = formData.get("admin") === "oui";
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("nommer_admin_communaute", {
    p_communaute_id: id,
    p_profile_id: membre,
    p_admin: admin,
  });
  if (error)
    versPage(slug, "erreur", messageRefusCommunaute(error.message, "Action impossible pour l'instant."), "#membres");
  revalidatePath(`/communaute/${slug}`);
  versPage(slug, "message", admin ? "Administrateur nommé." : "Rôle d'administrateur retiré.", "#membres");
}

// Le code ne se relit pas en base (colonne fermée au public) : il est
// affiché une fois, dans l'adresse de retour. Valable 30 minutes, une fois.
export async function obtenirCodeLiaisonDiscord(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { data: code, error } = await supabase.rpc("code_liaison_discord", { p_communaute_id: id });
  if (error || !code) {
    versPage(
      slug,
      "erreur",
      messageRefusCommunaute(error?.message ?? "", "Code indisponible pour l'instant."),
      "#gestion",
    );
  }
  redirect(`/communaute/${encodeURIComponent(slug)}?code=${encodeURIComponent(code)}#gestion`);
}

export async function delierServeurDiscord(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("delier_serveur_discord", { p_communaute_id: id });
  if (error)
    versPage(slug, "erreur", messageRefusCommunaute(error.message, "Action impossible pour l'instant."), "#gestion");
  revalidatePath(`/communaute/${slug}`);
  versPage(slug, "message", "Serveur Discord délié.", "#gestion");
}
