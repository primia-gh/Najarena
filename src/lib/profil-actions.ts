"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
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

// Suppression de compte en libre-service (28/09/2026, audit M17). La base
// anonymise le profil et efface les données personnelles
// (supprimer_mon_compte, docs/schema.sql) ; ici, l'identité de connexion
// est ensuite effacée côté Supabase Auth. Chaque étape peut être relancée
// sans risque si la suivante échoue.
const MESSAGES_SUPPRESSION: Record<string, string> = {
  COMPTE_ADMINISTRATEUR: "Un compte administrateur ne se supprime pas d'ici : retire d'abord tes droits d'administration.",
  TOURNOI_EN_COURS:
    "Tu joues un tournoi en cours : attends sa fin (les points de tous les joueurs sont calculés à la clôture).",
  TOURNOI_ORGANISE_ACTIF:
    "Tu organises un tournoi ouvert ou en cours : annule-le depuis ton cockpit, ou attends qu'il soit terminé.",
  EQUIPE_AVEC_MEMBRES:
    "Tu es capitaine d'une équipe qui a d'autres membres : retire-les depuis la page de l'équipe d'abord.",
  ABONNEMENT_ACTIF: "Ton abonnement payant est encore actif : résilie-le depuis « Gérer mon abonnement » d'abord.",
};

export async function supprimerMonCompte(formData: FormData) {
  if (String(formData.get("confirmation") ?? "").trim().toUpperCase() !== "SUPPRIMER") {
    retour("erreur", "Écris SUPPRIMER dans le champ de confirmation pour supprimer ton compte.");
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion");
  const id = userData.user.id;

  const { error } = await supabase.rpc("supprimer_mon_compte");
  if (error) {
    const code = Object.keys(MESSAGES_SUPPRESSION).find((c) => error.message.includes(c));
    retour("erreur", code ? MESSAGES_SUPPRESSION[code] : "Suppression impossible pour l'instant. Réessaie dans un instant.");
  }

  // Identité de connexion : e-mail rendu illisible et connexion fermée
  // (suppression « douce » de Supabase Auth, qui garde la ligne à laquelle
  // le profil anonyme est rattaché). Les informations reçues à
  // l'inscription (pseudo, profil Discord) sont vidées d'abord.
  const admin = creerClientAdmin();
  let identiteEffacee = false;
  if (admin) {
    const { data: compte } = await admin.auth.admin.getUserById(id);
    const metadonnees = compte.user?.user_metadata ?? {};
    await admin.auth.admin.updateUserById(id, {
      user_metadata: Object.fromEntries(Object.keys(metadonnees).map((cle) => [cle, null])),
    });
    const { error: erreurAuth } = await admin.auth.admin.deleteUser(id, true);
    identiteEffacee = !erreurAuth;
  }

  if (!identiteEffacee) {
    retour(
      "erreur",
      "Ton profil a été anonymisé, mais ton adresse de connexion n'a pas pu être effacée : relance la suppression.",
    );
  }

  await supabase.auth.signOut().catch(() => undefined);
  redirect(`/connexion?message=${encodeURIComponent("Ton compte a été supprimé.")}`);
}
