"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Messages affichés pour chaque refus de la fonction s_inscrire_tournoi
// (docs/schema.sql). Les vérifications elles-mêmes (tournoi ouvert, places
// restantes, doublon) se font dans la base, en une seule opération sous
// verrou : un appel direct à la base, sans passer par cette action, est
// refusé de la même façon, et deux inscriptions simultanées ne peuvent
// plus dépasser la capacité (audit du 27/09/2026, E1).
const MESSAGES_REFUS: Record<string, string> = {
  INSCRIPTIONS_FERMEES: "Les inscriptions sont fermées pour ce tournoi.",
  TOURNOI_COMPLET: "Ce tournoi est complet.",
  DEJA_INSCRIT: "Tu es déjà inscrit à ce tournoi.",
  TOURNOI_INTROUVABLE: "Ce tournoi n'existe pas.",
  // Compte Riot vérifié de la région du tournoi exigé (28/09/2026, audit
  // E2) : sans lui, aucun résultat ne peut être retrouvé automatiquement.
  COMPTE_RIOT_REQUIS: "Lie et vérifie ton compte Riot avant de t'inscrire : c'est lui qui permet de retrouver tes résultats.",
  REGION_DIFFERENTE: "Ce tournoi se joue sur une autre région que ton compte Riot vérifié.",
};

export async function sInscrireATournoi(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("s_inscrire_tournoi", { p_tournament_id: tournamentId });

  if (error) {
    const code = Object.keys(MESSAGES_REFUS).find((c) => error.message.includes(c));
    const message = code ? MESSAGES_REFUS[code] : "Impossible de s'inscrire pour l'instant.";
    redirect(`/lol/tournois/${slug}?erreur=${encodeURIComponent(message)}`);
  }

  redirect(`/lol/tournois/${slug}`);
}
