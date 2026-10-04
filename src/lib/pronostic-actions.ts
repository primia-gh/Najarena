"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { messageRefusPronostic } from "@/lib/pronostics";

// Pronostic gratuit (03/10/2026, audit N20) : la base vérifie tout (phase,
// match pas commencé, pronostiqueur hors du tournoi) et garde le dernier
// choix tant que le match n'a pas commencé.
export async function pronostiquer(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const gagnant = String(formData.get("gagnant_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const page = `/lol/tournois/${encodeURIComponent(slug)}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/connexion?suite=${encodeURIComponent(page)}`);

  const { error } = await supabase.rpc("pronostiquer", { p_match_id: matchId, p_gagnant: gagnant });
  if (error) {
    redirect(
      `${page}?erreur=${encodeURIComponent(messageRefusPronostic(error.message, "Impossible d'enregistrer ce pronostic pour l'instant."))}#pronostics`,
    );
  }
  redirect(`${page}?message=${encodeURIComponent("Pronostic enregistré.")}#pronostics`);
}
