"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifierJoueur, URL_SITE } from "@/lib/notifications";
import { echapperHtml } from "@/lib/echappement";
import { MESSAGE_EN_REVUE, messageModeration } from "@/lib/moderation";
import { destinationInterne } from "@/lib/redirection";

// Démarrer une conversation est réservé à l'offre organisateur — la policy
// RLS "un organisateur demarre une conversation" le revérifie elle-même
// (exists comptes_offres ...), donc pas de contournement possible même en
// appelant cette action directement avec un id forgé.
export async function demarrerConversation(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const destinataireId = String(formData.get("destinataire_id") ?? "");
  const contenu = String(formData.get("message") ?? "").trim().slice(0, 2000);
  const retour = destinationInterne(String(formData.get("retour") ?? "") || null, "/moi/messages");

  if (!contenu || !destinataireId) {
    redirect(`${retour}?erreur=${encodeURIComponent("Message vide.")}`);
  }

  // Une conversation existe peut-être déjà (index unique sur la paire) —
  // on la réutilise plutôt que d'échouer sur le conflit.
  const { data: existante } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(profile_a.eq.${userData.user.id},profile_b.eq.${destinataireId}),and(profile_a.eq.${destinataireId},profile_b.eq.${userData.user.id})`,
    )
    .maybeSingle();

  let conversationId = existante?.id;

  if (!conversationId) {
    const { data: nouvelle, error } = await supabase
      .from("conversations")
      .insert({ profile_a: userData.user.id, profile_b: destinataireId })
      .select("id")
      .single();

    if (error || !nouvelle) {
      redirect(`${retour}?erreur=${encodeURIComponent("Impossible de démarrer la conversation — offre Organisateur requise.")}`);
    }
    conversationId = nouvelle.id;
  }

  const { data: envoye, error: erreurMessage } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, expediteur_id: userData.user.id, contenu })
    .select("en_revue")
    .single();

  if (erreurMessage) {
    redirect(`${retour}?erreur=${encodeURIComponent(messageModeration(erreurMessage.message) ?? "Message non envoyé.")}`);
  }

  // Modération (audit N27) : message retenu pour relecture, pas encore remis.
  if (envoye?.en_revue) {
    redirect(`/moi/messages/${conversationId}?message=${encodeURIComponent(MESSAGE_EN_REVUE)}`);
  }

  const { data: expediteur } = await supabase
    .from("profiles")
    .select("pseudo")
    .eq("id", userData.user.id)
    .maybeSingle();

  await notifierJoueur(
    destinataireId,
    `Nouveau message — ${expediteur?.pseudo ?? "un organisateur"}`,
    "Tu as reçu un nouveau message sur Najarena",
    `<p>${echapperHtml(expediteur?.pseudo ?? "Un organisateur")} t'a envoyé un message.</p>
     <p><a href="${URL_SITE}/moi/messages/${conversationId}">Voir la conversation</a></p>`,
  );

  redirect(`/moi/messages/${conversationId}`);
}

export async function envoyerMessage(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const conversationId = String(formData.get("conversation_id") ?? "");
  const contenu = String(formData.get("message") ?? "").trim().slice(0, 2000);

  if (!contenu) {
    redirect(`/moi/messages/${conversationId}?erreur=${encodeURIComponent("Message vide.")}`);
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("profile_a, profile_b")
    .eq("id", conversationId)
    .maybeSingle();

  const { data: envoye, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, expediteur_id: userData.user.id, contenu })
    .select("en_revue")
    .single();

  if (error) {
    // Refus de la règle d'envoi : l'un des deux a bloqué l'autre (18/11/2026).
    const bloque = error.message.includes("row-level security");
    redirect(
      `/moi/messages/${conversationId}?erreur=${encodeURIComponent(
        messageModeration(error.message) ??
          (bloque ? "Message non envoyé : cette conversation est fermée (l'un de vous a bloqué l'autre)." : "Message non envoyé."),
      )}`,
    );
  }

  // Modération (audit N27) : message retenu pour relecture, pas encore remis.
  if (envoye?.en_revue) {
    redirect(`/moi/messages/${conversationId}?message=${encodeURIComponent(MESSAGE_EN_REVUE)}`);
  }

  if (conversation) {
    const destinataireId = conversation.profile_a === userData.user.id ? conversation.profile_b : conversation.profile_a;
    const { data: expediteur } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", userData.user.id)
      .maybeSingle();

    await notifierJoueur(
      destinataireId,
      `Nouveau message — ${expediteur?.pseudo ?? "Najarena"}`,
      "Tu as reçu un nouveau message sur Najarena",
      `<p>${echapperHtml(expediteur?.pseudo ?? "Un joueur")} t'a répondu.</p>
       <p><a href="${URL_SITE}/moi/messages/${conversationId}">Voir la conversation</a></p>`,
    );
  }

  redirect(`/moi/messages/${conversationId}`);
}

// Blocage d'un joueur (18/11/2026) : coupe les messages dans les deux sens
// (règle d'envoi des messages, en base), ses demandes de duo et son
// annonce de duo. Il n'en est pas prévenu.
export async function bloquerJoueur(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }
  const joueurId = String(formData.get("joueur_id") ?? "");
  const retour = destinationInterne(String(formData.get("retour") ?? "") || null, "/moi/messages");
  const { error } = await supabase.rpc("bloquer_joueur", { p_joueur: joueurId });
  if (error) {
    redirect(`${retour}?erreur=${encodeURIComponent("Impossible de bloquer ce joueur pour l'instant.")}`);
  }
  redirect(
    `${retour}?message=${encodeURIComponent("Joueur bloqué : plus aucun message ne passe entre vous, ni demande de duo. Il n'en est pas prévenu.")}`,
  );
}

export async function debloquerJoueur(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }
  const joueurId = String(formData.get("joueur_id") ?? "");
  const retour = destinationInterne(String(formData.get("retour") ?? "") || null, "/moi/messages");
  await supabase.rpc("debloquer_joueur", { p_joueur: joueurId });
  redirect(`${retour}?message=${encodeURIComponent("Joueur débloqué.")}`);
}
