"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { lireNiveau } from "@/lib/niveau-tournoi";
import { estRole } from "@/lib/duo";
import { DUREE_ANNONCE_RECRUTEMENT_JOURS, DUREE_CANDIDATURE_JOURS, messageRecrutement, postesValides } from "@/lib/recrutement";

// Équipes qui recrutent (19/11/2026). Les règles sont dans la base ; ces
// actions appellent ses fonctions puis préviennent l'autre partie (push et
// message privé Discord, jamais d'e-mail).

const SLUG = /^[a-z0-9-]{1,120}$/;

function page(slug: string): string {
  return SLUG.test(slug) ? `/equipe/${slug}` : "/lol/recrutement";
}

function retour(slug: string, type: "message" | "erreur", texte: string): never {
  redirect(`${page(slug)}?${type}=${encodeURIComponent(texte)}#retour`);
}

async function session(slug: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/connexion?suite=${encodeURIComponent(page(slug))}`);
  return { supabase, utilisateur: userData.user };
}

export async function publierRecrutement(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const teamId = String(formData.get("team_id") ?? "");
  const { supabase } = await session(slug);
  const niveau = lireNiveau(formData.get("niveau_min"), "", "1v1");
  if (!niveau.ok) retour(slug, "erreur", niveau.erreur);
  const { error } = await supabase.rpc("publier_recrutement", {
    p_team: teamId,
    p_postes: postesValides(formData.getAll("postes")),
    p_niveau_min: niveau.min,
    p_message: String(formData.get("message") ?? "").slice(0, 1000),
  });
  if (error) retour(slug, "erreur", messageRecrutement(error.message, "Impossible de publier l'annonce pour l'instant."));
  retour(slug, "message", `Annonce publiée pour ${DUREE_ANNONCE_RECRUTEMENT_JOURS} jours : elle apparaît dans « Équipes qui recrutent ».`);
}

export async function retirerRecrutement(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { supabase } = await session(slug);
  const { error } = await supabase.rpc("retirer_recrutement", { p_team: String(formData.get("team_id") ?? "") });
  if (error) retour(slug, "erreur", messageRecrutement(error.message, "Impossible de retirer l'annonce pour l'instant."));
  retour(slug, "message", "Annonce retirée. Les candidatures déjà reçues attendent encore ta réponse.");
}

export async function postulerEquipe(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const teamId = String(formData.get("team_id") ?? "");
  const poste = formData.get("poste");
  const { supabase, utilisateur } = await session(slug);
  const { error } = await supabase.rpc("postuler_equipe", {
    p_team: teamId,
    p_poste: estRole(poste) ? poste : "",
    p_message: String(formData.get("message") ?? "").slice(0, 1000),
  });
  if (error) retour(slug, "erreur", messageRecrutement(error.message, "Impossible d'envoyer ta candidature pour l'instant."));

  const [{ data: equipe }, { data: moi }] = await Promise.all([
    supabase.from("teams").select("capitaine_id, nom").eq("id", teamId).maybeSingle(),
    supabase.from("profiles").select("pseudo").eq("id", utilisateur.id).maybeSingle(),
  ]);
  if (equipe) {
    await envoyerRappel(
      equipe.capitaine_id,
      `${moi?.pseudo ?? "Un joueur"} veut rejoindre ${equipe.nom}`,
      `Une candidature attend ta réponse sur la page de l'équipe : accepte-la pour l'ajouter à l'effectif, ou décline. Elle expire dans ${DUREE_CANDIDATURE_JOURS} jours.`,
      `${URL_SITE}${page(slug)}#recrutement`,
    );
  }
  retour(slug, "message", "Candidature envoyée. Le capitaine est prévenu ; tu le seras de sa réponse.");
}

export async function repondreCandidature(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const candidatureId = String(formData.get("candidature_id") ?? "");
  const accepte = formData.get("reponse") === "accepter";
  const { supabase } = await session(slug);
  const { data: candidature } = await supabase
    .from("candidatures_equipe")
    .select("profile_id, team:teams(nom)")
    .eq("id", candidatureId)
    .maybeSingle();
  const { error } = await supabase.rpc("repondre_candidature", { p_candidature: candidatureId, p_accepte: accepte });
  if (error) retour(slug, "erreur", messageRecrutement(error.message, "Impossible de répondre à cette candidature pour l'instant."));

  if (candidature) {
    const nom = candidature.team?.nom ?? "L'équipe";
    await envoyerRappel(
      candidature.profile_id,
      accepte ? `Bienvenue dans ${nom}` : `Réponse de ${nom}`,
      accepte
        ? "Le capitaine a accepté ta candidature : tu fais maintenant partie de l'effectif."
        : "Le capitaine a décliné ta candidature. D'autres équipes recrutent peut-être à ton poste.",
      accepte ? `${URL_SITE}${page(slug)}` : `${URL_SITE}/lol/recrutement`,
    );
  }
  retour(
    slug,
    "message",
    accepte ? "Candidature acceptée : le joueur fait partie de l'effectif." : "Candidature déclinée.",
  );
}

export async function annulerCandidature(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { supabase } = await session(slug);
  const { data: fait } = await supabase.rpc("annuler_candidature", {
    p_candidature: String(formData.get("candidature_id") ?? ""),
  });
  if (!fait) retour(slug, "erreur", "Cette candidature n'attend plus de réponse : rien à retirer.");
  retour(slug, "message", "Candidature retirée.");
}
