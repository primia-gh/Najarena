"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { messageRefusArene } from "@/lib/arene";
import { prevenirDuelArene } from "@/lib/arene-serveur";

// Arène 1v1 (03/10/2026, audit N19). La base vérifie tout (compte Riot
// vérifié, suspension, duel déjà en cours…) et apparie ; si un adversaire
// attendait déjà, le duel est ouvert tout de suite.

function versArene(type: "message" | "erreur", texte: string): never {
  redirect(`/lol/arene?${type}=${encodeURIComponent(texte)}`);
}

export async function entrerDansArene(formData: FormData) {
  const condition = formData.get("condition_victoire") === "classique" ? "classique" : "nexus";
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Flol%2Farene");

  const { data: slug, error } = await supabase.rpc("rejoindre_arene", { p_condition: condition });
  if (error) versArene("erreur", messageRefusArene(error.message, "Impossible d'entrer dans l'arène pour l'instant."));

  if (slug) {
    await prevenirDuelArene(slug, userData.user.id);
    redirect(`/lol/tournois/${slug}#ton-match`);
  }
  versArene("message", "Tu es dans la file : on te prévient dès qu'un adversaire de ton niveau est trouvé.");
}

export async function quitterArene() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion");

  await supabase.rpc("quitter_arene");
  versArene("message", "Tu as quitté la file de l'arène.");
}
