"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sInscrireATournoi(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.from("registrations").insert({
    tournament_id: tournamentId,
    profile_id: userData.user.id,
  });

  if (error) {
    const message = error.message.includes("duplicate key")
      ? "Tu es déjà inscrit à ce tournoi."
      : "Impossible de s'inscrire pour l'instant.";
    redirect(`/lol/tournois/${slug}?erreur=${encodeURIComponent(message)}`);
  }

  redirect(`/lol/tournois/${slug}`);
}
