"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { chargerOffre, ORDRE_OFFRE } from "@/lib/offres";
import { estFormatBilan } from "@/lib/bilan";
import { redigerAnalyseProgression } from "@/lib/progression-ia-serveur";

// Analyse de progression rédigée par l'IA (18/11/2026) : à la demande du
// joueur (offre Elite), depuis /moi/bilan, dans la limite des demandes à
// l'IA (10 par 24 h, partagée avec la revue de match et l'assistant
// organisateur). Le résultat ?analyse=… est lu par la page du bilan.
export async function demanderAnalyseProgression(formData: FormData) {
  const demande = String(formData.get("format") ?? "");
  const format = estFormatBilan(demande) ? demande : "1v1";
  const retour: (code: string) => never = (code) =>
    redirect(`/moi/bilan?format=${format}&analyse=${code}#analyse-ia`);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Fmoi%2Fbilan");
  const moi = userData.user.id;

  const { offre } = await chargerOffre(supabase, moi);
  if (ORDRE_OFFRE[offre] < ORDRE_OFFRE.elite) retour("offre");

  const admin = creerClientAdmin();
  if (!admin) retour("indisponible");
  retour(await redigerAnalyseProgression(supabase, admin, moi, format));
}
