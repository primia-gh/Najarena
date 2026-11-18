"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { DUREE_ANNONCE_DUO_JOURS, DUREE_DEMANDE_DUO_JOURS, estCreneau, estObjectif, estRole, messageRefusDuo } from "@/lib/duo";

// Matching duo (18/11/2026). Toutes les règles — compte Riot vérifié, même
// serveur, une demande en attente par paire, plafond de demandes, délai
// après un refus, conversation ouverte seulement sur accord — sont
// appliquées par la base (docs/schema.sql) ; ces actions appellent ses
// fonctions, puis préviennent l'autre joueur (push et message privé
// Discord, jamais d'e-mail).

const PAGE = "/lol/duo";

function retour(type: "message" | "erreur", texte: string, ancre = ""): never {
  redirect(`${PAGE}?${type}=${encodeURIComponent(texte)}${ancre}`);
}

async function session() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/connexion?suite=${encodeURIComponent(PAGE)}`);
  return { supabase, utilisateur: userData.user };
}

async function pseudoDe(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("pseudo").eq("id", id).maybeSingle();
  return data?.pseudo ?? "Un joueur";
}

export async function publierAnnonceDuo(formData: FormData) {
  const { supabase } = await session();
  const poste = formData.get("poste");
  const { error } = await supabase.rpc("publier_annonce_duo", {
    p_poste: estRole(poste) ? poste : "",
    p_postes_cherches: formData.getAll("postes_cherches").filter(estRole),
    p_creneaux: formData.getAll("creneaux").filter(estCreneau),
    p_objectif: estObjectif(formData.get("objectif")) ? String(formData.get("objectif")) : "",
    p_message: String(formData.get("message") ?? "").slice(0, 500),
  });
  if (error) retour("erreur", messageRefusDuo(error.message, "Impossible de publier ton annonce pour l'instant."), "#mon-annonce");
  retour("message", `Annonce publiée pour ${DUREE_ANNONCE_DUO_JOURS} jours. Voici les joueurs qui te correspondent.`, "#pour-toi");
}

export async function retirerAnnonceDuo() {
  const { supabase } = await session();
  const { error } = await supabase.rpc("retirer_annonce_duo");
  if (error) retour("erreur", messageRefusDuo(error.message, "Impossible de retirer ton annonce pour l'instant."));
  retour("message", "Annonce retirée. Tes demandes encore en attente ont été annulées.");
}

export async function demanderDuo(formData: FormData) {
  const destinataireId = String(formData.get("destinataire_id") ?? "");
  const { supabase, utilisateur } = await session();
  const { error } = await supabase.rpc("demander_duo", { p_destinataire: destinataireId });
  if (error) retour("erreur", messageRefusDuo(error.message, "Impossible d'envoyer cette demande pour l'instant."), "#pour-toi");

  await envoyerRappel(
    destinataireId,
    `${await pseudoDe(supabase, utilisateur.id)} te propose de jouer en duo`,
    `Son annonce correspond à la tienne. Accepte pour ouvrir une conversation, ou décline : la demande expire dans ${DUREE_DEMANDE_DUO_JOURS} jours.`,
    `${URL_SITE}${PAGE}#demandes`,
  );
  retour("message", "Demande envoyée. Si ce joueur accepte, une conversation s'ouvre dans ta messagerie.", "#demandes");
}

export async function repondreDemandeDuo(formData: FormData) {
  const demandeId = String(formData.get("demande_id") ?? "");
  const accepte = formData.get("reponse") === "accepter";
  const { supabase, utilisateur } = await session();

  const { data: conversationId, error } = await supabase.rpc("repondre_demande_duo", {
    p_demande: demandeId,
    p_accepte: accepte,
  });
  if (error) retour("erreur", messageRefusDuo(error.message, "Impossible de répondre à cette demande pour l'instant."), "#demandes");
  if (!accepte || !conversationId) retour("message", "Demande déclinée. Ce joueur ne pourra pas te la renvoyer avant 30 jours.", "#demandes");

  const { data: demande } = await supabase.from("demandes_duo").select("demandeur_id").eq("id", demandeId).maybeSingle();
  if (demande) {
    await envoyerRappel(
      demande.demandeur_id,
      `${await pseudoDe(supabase, utilisateur.id)} accepte ton duo`,
      "Votre conversation est ouverte : convenez d'une heure pour jouer.",
      `${URL_SITE}/moi/messages/${conversationId}`,
    );
  }
  redirect(`/moi/messages/${conversationId}`);
}

export async function annulerDemandeDuo(formData: FormData) {
  const demandeId = String(formData.get("demande_id") ?? "");
  const { supabase } = await session();
  const { data: fait } = await supabase.rpc("annuler_demande_duo", { p_demande: demandeId });
  if (!fait) retour("erreur", "Cette demande n'attend plus de réponse : rien à retirer.", "#demandes");
  retour("message", "Demande retirée.", "#demandes");
}
