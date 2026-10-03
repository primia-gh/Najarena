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

  // Le joueur ne peut plus modifier son inscription directement (28/09/2026,
  // audit E1 : il pouvait se confirmer à tout moment, changer sa tête de
  // série ou de tournoi). La fonction confirmer_presence revérifie la
  // fenêtre de check-in dans la base, sous verrou du tournoi : un check-in
  // ne peut plus se glisser pendant la génération du bracket.
  const { data: confirmee, error } = await supabase.rpc("confirmer_presence", {
    p_tournament_id: tournamentId,
  });

  if (error?.message.includes("COMPTE_SUSPENDU")) {
    redirect(`${page}?erreur=${encodeURIComponent("Ton compte est suspendu : tu ne peux pas confirmer ta présence.")}`);
  }

  // Tournoi 5v5 (audit N21) : un joueur a quitté l'équipe ou a été suspendu
  // depuis l'inscription.
  if (error?.message.includes("ALIGNEMENT_INCOMPLET")) {
    redirect(
      `${page}?erreur=${encodeURIComponent("Ton alignement n'a plus cinq joueurs : complète-le avant de confirmer la présence de l'équipe.")}`,
    );
  }

  if (error?.message.includes("CHECKIN_FERME")) {
    redirect(`${page}?erreur=${encodeURIComponent("Le check-in n'est pas ouvert pour ce tournoi.")}`);
  }

  if (!confirmee) {
    redirect(`${page}?erreur=${encodeURIComponent("Aucune inscription en attente de check-in.")}`);
  }

  redirect(
    `${page}?message=${encodeURIComponent(`Présence confirmée. Début du tournoi à ${heureParis(tournoi.debute_le)}.`)}`,
  );
}
