"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { demanderJson } from "@/lib/claude";
import { adresseRecherche, construireDemandeRecherche, SCHEMA_RECHERCHE, validerFiltres } from "@/lib/recherche-ia";

// Recherche de joueurs en langage naturel (03/10/2026, audit N29) : l'IA
// traduit la demande en filtres, la recherche habituelle fait le reste.
// Offre Organisateur, dans la limite des demandes à l'IA (10 par 24 h).
export async function rechercherEnLangageNaturel(formData: FormData) {
  const demande = String(formData.get("demande") ?? "").trim();
  const erreur: (texte: string) => never = (texte) => redirect(`/lol/recherche?erreur=${encodeURIComponent(texte)}`);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }
  const { offre } = await chargerOffre(supabase, userData.user.id);
  if (offre !== "organisateur") {
    redirect(`/tarifs?erreur=${encodeURIComponent("La recherche de joueurs demande l'offre Organisateur.")}`);
  }
  if (demande.length < 3 || demande.length > 300) {
    return erreur("Décris le joueur recherché en 3 à 300 caractères.");
  }

  const { data: autorise } = await supabase.rpc("reserver_appel_assistant_ia");
  if (!autorise) {
    return erreur("Tu as utilisé tes 10 demandes à l'IA des dernières 24 heures : utilise les filtres ci-dessous.");
  }

  const resultat = await demanderJson({
    ...construireDemandeRecherche(demande),
    schema: SCHEMA_RECHERCHE,
    valider: validerFiltres,
  });
  if (!resultat.ok) {
    return erreur("La recherche en langage naturel est indisponible pour l'instant : utilise les filtres ci-dessous.");
  }
  redirect(adresseRecherche(resultat.valeur, demande));
}
