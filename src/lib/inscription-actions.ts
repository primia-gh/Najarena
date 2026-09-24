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

  // Vérifié ici et pas seulement caché sur la page (24/09/2026) : un appel
  // direct ne doit pas pouvoir inscrire un joueur à un tournoi fermé ou
  // plein — au-delà de la capacité, le bracket ne peut pas le placer.
  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("statut, capacite")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournoi || tournoi.statut !== "ouvert") {
    redirect(`/lol/tournois/${slug}?erreur=${encodeURIComponent("Les inscriptions sont fermées pour ce tournoi.")}`);
  }

  const { count: nbInscrits } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .neq("statut", "retire");

  if ((nbInscrits ?? 0) >= tournoi.capacite) {
    redirect(`/lol/tournois/${slug}?erreur=${encodeURIComponent("Ce tournoi est complet.")}`);
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
