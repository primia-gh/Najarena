"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkinEstOuvert } from "@/lib/checkin";
import { heureParis } from "@/lib/tournois-auto/creneaux";

// Check-in fait par le joueur lui-même (24/09/2026) — jusqu'ici, seul
// l'organisateur pouvait confirmer une inscription (confirmerInscription,
// organisation-actions.ts), ce qui rendait impossible un tournoi sans
// organisateur présent. L'organisateur garde la main : il peut toujours
// confirmer ou marquer absent depuis son cockpit.
export async function confirmerMaPresence(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("slug, statut, checkin_ouvre_le, debute_le")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournoi) {
    redirect("/lol/tournois");
  }

  const page = `/lol/tournois/${tournoi.slug}`;

  if (!checkinEstOuvert(tournoi.statut, tournoi.checkin_ouvre_le)) {
    redirect(`${page}?erreur=${encodeURIComponent("Le check-in n'est pas ouvert pour ce tournoi.")}`);
  }

  // RLS : un joueur ne peut modifier que sa propre inscription.
  const { data: confirmee } = await supabase
    .from("registrations")
    .update({ statut: "confirme", confirme_le: new Date().toISOString() })
    .eq("tournament_id", tournamentId)
    .eq("profile_id", userData.user.id)
    .eq("statut", "inscrit")
    .select("id");

  if (!confirmee?.length) {
    redirect(`${page}?erreur=${encodeURIComponent("Aucune inscription en attente de check-in.")}`);
  }

  redirect(
    `${page}?message=${encodeURIComponent(`Présence confirmée. Début du tournoi à ${heureParis(tournoi.debute_le)}.`)}`,
  );
}
