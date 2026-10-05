"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { messageRefusAnalyse } from "@/lib/analyse-reglages";

// Réglages de l'analyse du joueur (bilan, étape 2) : accord pour lire ses
// parties classées, bilan de la semaine sur Discord. Les règles (compte
// Riot vérifié, offre Elite, Discord lié, effacement au retrait de
// l'accord) sont appliquées par la base (regler_analyse) ; cette action
// l'appelle.

function versBilan(type: "message" | "erreur", texte: string, format: string | null): never {
  const suite = format ? `format=${encodeURIComponent(format)}&` : "";
  redirect(`/moi/bilan?${suite}${type}=${encodeURIComponent(texte)}#reglages`);
}

export async function reglerAnalyse(formData: FormData) {
  const classees = formData.get("classees") === "oui";
  const bilanHebdo = formData.get("bilan_hebdo") === "oui";
  const format = formData.get("format") ? String(formData.get("format")) : null;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Fmoi%2Fbilan");

  const { data: avant } = await supabase
    .from("analyse_reglages")
    .select("classees")
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  const { error } = await supabase.rpc("regler_analyse", { p_classees: classees, p_bilan_hebdo: bilanHebdo });
  if (error) versBilan("erreur", messageRefusAnalyse(error.message, "Réglage impossible pour l'instant."), format);
  revalidatePath("/moi/bilan");

  const etaitActive = avant?.classees ?? false;
  if (classees && !etaitActive) {
    versBilan(
      "message",
      "C'est noté : tes parties classées vont être lues chez Riot dans les prochaines minutes, par petits lots.",
      "classees",
    );
  }
  if (!classees && etaitActive) versBilan("message", "Analyse arrêtée : tes parties classées et ton rang ont été effacés.", format);
  versBilan("message", bilanHebdo ? "Bilan de la semaine activé : il arrive chaque lundi sur Discord." : "Réglages enregistrés.", format);
}
