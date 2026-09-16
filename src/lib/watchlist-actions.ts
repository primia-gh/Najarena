"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";

async function verifierOrganisateur(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { offre } = await chargerOffre(supabase, userData.user.id);
  if (offre !== "organisateur") {
    redirect(`/tarifs?erreur=${encodeURIComponent("La watchlist demande l'offre Organisateur.")}`);
  }

  return userData.user;
}

export async function suivreJoueur(formData: FormData) {
  const supabase = await createClient();
  const utilisateur = await verifierOrganisateur(supabase);

  const joueurSuiviId = String(formData.get("joueur_suivi_id") ?? "");
  const retour = String(formData.get("retour") ?? "/lol/recherche");

  const { error } = await supabase
    .from("watchlist")
    .upsert({ recruteur_id: utilisateur.id, joueur_suivi_id: joueurSuiviId });

  if (error) {
    redirect(`${retour}?erreur=${encodeURIComponent("Impossible de suivre ce joueur pour l'instant.")}`);
  }

  redirect(`${retour}?message=${encodeURIComponent("Joueur ajouté à ta watchlist.")}`);
}

export async function retirerDeLaWatchlist(formData: FormData) {
  const supabase = await createClient();
  const utilisateur = await verifierOrganisateur(supabase);

  const joueurSuiviId = String(formData.get("joueur_suivi_id") ?? "");
  const retour = String(formData.get("retour") ?? "/moi/watchlist");

  await supabase
    .from("watchlist")
    .delete()
    .eq("recruteur_id", utilisateur.id)
    .eq("joueur_suivi_id", joueurSuiviId);

  redirect(`${retour}?message=${encodeURIComponent("Joueur retiré de ta watchlist.")}`);
}
