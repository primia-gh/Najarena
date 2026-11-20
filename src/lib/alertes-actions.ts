"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lireReglageAlertes, messageRefusAlertes } from "@/lib/alertes-tournoi";

// Alertes « tournoi pour toi » (20/11/2026) : le réglage passe par les
// fonctions de la base (regler_alertes_tournoi, couper_alertes_tournoi), qui
// vérifient le compte Riot, les créneaux et les formats.

const PAGE = "/moi";

function retour(type: "message" | "erreur", texte: string): never {
  // bloc=alertes : le message s'affiche dans le bloc lui-même, là où
  // l'ancre ramène le joueur (sinon il restait hors de l'écran, en haut).
  redirect(`${PAGE}?bloc=alertes&${type}=${encodeURIComponent(texte)}#moi-alertes`);
}

async function session() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/connexion?suite=${encodeURIComponent(PAGE)}`);
  return supabase;
}

export async function reglerAlertesTournoi(formData: FormData) {
  const supabase = await session();
  const { creneaux, formats } = lireReglageAlertes(formData);
  const { error } = await supabase.rpc("regler_alertes_tournoi", { p_creneaux: creneaux, p_formats: formats });
  if (error) retour("erreur", messageRefusAlertes(error.message, "Impossible d'enregistrer tes alertes pour l'instant."));
  retour("message", "Alertes enregistrées.");
}

export async function couperAlertesTournoi() {
  const supabase = await session();
  const { error } = await supabase.rpc("couper_alertes_tournoi");
  if (error) retour("erreur", "Impossible de couper tes alertes pour l'instant.");
  retour("message", "Alertes coupées.");
}
