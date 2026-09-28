"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estPseudoAutomatique, MESSAGE_PSEUDO_INVALIDE, PSEUDO_REGEX } from "@/lib/pseudo";

// Modification du profil (28/09/2026, audit E7) : pseudo, pays et visites
// anonymes. Toutes les règles (unicité, un changement de pseudo par mois,
// ancienne adresse du CV qui redirige) sont appliquées par la base, dans
// modifier_mon_profil (docs/schema.sql) ; ici, seulement les messages.

const MESSAGES_REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi pour modifier ton profil.",
  PSEUDO_INVALIDE: MESSAGE_PSEUDO_INVALIDE,
  PSEUDO_RESERVE: "Les pseudos « Joueur-… » sont réservés aux comptes qui n'ont pas encore choisi le leur.",
  PSEUDO_PRIS: "Ce pseudo est déjà pris.",
  PSEUDO_RECEMMENT_MODIFIE:
    "Tu as déjà changé de pseudo il y a moins de 30 jours : un CV garde la même identité le temps que ton classement se construise.",
  PAYS_INVALIDE: "Pays invalide : lettres, espaces, apostrophes et tirets uniquement, 40 caractères au plus.",
};

function retour(parametre: "erreur" | "message", texte: string): never {
  redirect(`/moi/profil?${parametre}=${encodeURIComponent(texte)}`);
}

export async function modifierMonProfil(formData: FormData) {
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const pays = String(formData.get("pays") ?? "").trim();
  const visitesAnonymes = formData.get("visites_anonymes") === "on";

  if (!PSEUDO_REGEX.test(pseudo)) retour("erreur", MESSAGE_PSEUDO_INVALIDE);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion");

  const { data: actuel } = await supabase.from("profiles").select("pseudo").eq("id", userData.user.id).maybeSingle();
  if (actuel && pseudo !== actuel.pseudo && estPseudoAutomatique(pseudo)) retour("erreur", MESSAGES_REFUS.PSEUDO_RESERVE);

  const { error } = await supabase.rpc("modifier_mon_profil", {
    p_pseudo: pseudo,
    p_pays: pays || null,
    p_visites_anonymes: visitesAnonymes,
  });

  if (error) {
    const code = Object.keys(MESSAGES_REFUS).find((c) => error.message.includes(c));
    retour("erreur", code ? MESSAGES_REFUS[code] : "Enregistrement impossible pour l'instant. Réessaie dans un instant.");
  }

  retour("message", "Profil enregistré.");
}
