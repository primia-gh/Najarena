"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MESSAGE_MAX = 200;

// Dernier point de la demande "matchmaking" du 12/09 — recherche de
// coéquipiers pour le 5v5. Une annonce par joueur (profile_id en clé
// primaire côté base) : republier revient à mettre à jour la même ligne.
export async function publierRechercheCoequipier(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const message = String(formData.get("message") ?? "").trim().slice(0, MESSAGE_MAX);

  const { error } = await supabase
    .from("recherches_coequipiers")
    .upsert({ profile_id: userData.user.id, message: message || null, cree_le: new Date().toISOString() });

  if (error) {
    redirect(
      `/lol/coequipiers?erreur=${encodeURIComponent("Impossible de publier ton annonce pour l'instant.")}`,
    );
  }

  redirect("/lol/coequipiers?message=" + encodeURIComponent("Annonce publiée."));
}

export async function retirerRechercheCoequipier() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  await supabase.from("recherches_coequipiers").delete().eq("profile_id", userData.user.id);

  redirect("/lol/coequipiers?message=" + encodeURIComponent("Annonce retirée."));
}
