"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { notifierJoueur, URL_SITE } from "@/lib/notifications";
import { echapperHtml } from "@/lib/echappement";
import { slugifier } from "@/lib/slug";

async function verifierAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/moi");
  }

  return userData.user;
}

export async function resoudreLitigeAdmin(formData: FormData) {
  const disputeId = String(formData.get("dispute_id") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();

  const supabase = await createClient();
  const utilisateur = await verifierAdmin(supabase);

  if (!resolution) {
    redirect(`/admin?erreur=${encodeURIComponent("La résolution ne peut pas être vide.")}`);
  }

  const { data: litige } = await supabase
    .from("disputes")
    .update({ resolution, resolu_par: utilisateur.id, resolu_le: new Date().toISOString() })
    .eq("id", disputeId)
    .select("ouvert_par, match:matches(tournament:tournaments(nom, slug))")
    .maybeSingle();

  if (litige?.match?.tournament) {
    await notifierJoueur(
      litige.ouvert_par,
      `Litige résolu — ${litige.match.tournament.nom}`,
      "Un administrateur a répondu à ton litige",
      `<p>Résolution : ${echapperHtml(resolution)}</p>
       <p><a href="${URL_SITE}/lol/tournois/${litige.match.tournament.slug}">Voir le tournoi</a></p>`,
    );
  }

  redirect("/admin");
}

// ---------- Suspension de compte (28/09/2026, audit M14) ----------
// Les CGU annoncent qu'un compte peut être suspendu en cas de manquement
// manifeste : voici l'outil. La base refuse ensuite toute inscription ou
// tout check-in du joueur (docs/schema.sql, « Suspension de compte ») ; ses
// résultats passés restent affichés, le journal des points ne change pas.

// Supabase Auth n'a pas de bannissement « sans fin » : 100 ans.
const DUREE_BANNISSEMENT = "876000h";

function retourSuspensions(parametre: "erreur" | "message", texte: string): never {
  redirect(`/admin?${parametre}=${encodeURIComponent(texte)}#suspensions`);
}

export async function suspendreCompte(formData: FormData) {
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const motif = String(formData.get("motif") ?? "").trim();

  const supabase = await createClient();
  const utilisateur = await verifierAdmin(supabase);

  if (motif.length < 3 || motif.length > 500) {
    retourSuspensions("erreur", "Le motif doit faire entre 3 et 500 caractères : il est communiqué au joueur.");
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("id, pseudo")
    .eq("slug", slugifier(pseudo))
    .maybeSingle();
  if (!profil) {
    retourSuspensions("erreur", `Aucun joueur avec le pseudo « ${pseudo} ».`);
  }
  if (profil.id === utilisateur.id) {
    retourSuspensions("erreur", "Tu ne peux pas suspendre ton propre compte.");
  }

  const { data: cibleAdmin } = await supabase.from("admins").select("profile_id").eq("profile_id", profil.id).maybeSingle();
  if (cibleAdmin) {
    retourSuspensions("erreur", "Un administrateur ne se suspend pas d'ici : retire-lui d'abord ses droits.");
  }

  const admin = creerClientAdmin();
  if (!admin) {
    retourSuspensions("erreur", "Suspension indisponible (SUPABASE_SERVICE_ROLE_KEY manquante).");
  }

  const { error: erreurSuspension } = await admin
    .from("suspensions")
    .insert({ profile_id: profil.id, motif, suspendu_par: utilisateur.id });
  // 23505 : déjà suspendu — on réapplique la coupure sans renvoyer d'e-mail.
  const dejaSuspendu = erreurSuspension?.code === "23505";
  if (erreurSuspension && !dejaSuspendu) {
    retourSuspensions("erreur", "Suspension impossible pour l'instant. Réessaie dans un instant.");
  }

  // Plus de connexion ni de renouvellement de session : la session en cours
  // expire d'elle-même (une heure au plus), et la base bloque déjà tout le
  // reste.
  const { error: erreurBannissement } = await admin.auth.admin.updateUserById(profil.id, {
    ban_duration: DUREE_BANNISSEMENT,
  });

  // Retrait des tournois pas encore commencés.
  const { data: tournoisAVenir } = await admin.from("tournaments").select("id").in("statut", ["ouvert", "checkin"]);
  const idsAVenir = (tournoisAVenir ?? []).map((t) => t.id);
  if (idsAVenir.length > 0) {
    await admin
      .from("registrations")
      .update({ statut: "retire" })
      .eq("profile_id", profil.id)
      .in("statut", ["inscrit", "confirme"])
      .in("tournament_id", idsAVenir);
  }

  if (!dejaSuspendu) {
    await notifierJoueur(
      profil.id,
      "Compte suspendu — Najarena",
      "Ton compte Najarena est suspendu",
      `<p>Motif : ${echapperHtml(motif)}</p>
       <p>Tu ne peux plus te connecter ni t'inscrire aux tournois. Pour contester cette décision, écris-nous à l'adresse indiquée dans les <a href="${URL_SITE}/mentions-legales">mentions légales</a>.</p>`,
    );
  }

  if (erreurBannissement) {
    retourSuspensions(
      "erreur",
      `${profil.pseudo} est suspendu (inscriptions bloquées), mais sa connexion n'a pas pu être coupée : relance la suspension.`,
    );
  }
  retourSuspensions("message", dejaSuspendu ? `${profil.pseudo} était déjà suspendu : connexion coupée à nouveau.` : `${profil.pseudo} est suspendu.`);
}

export async function leverSuspension(formData: FormData) {
  const suspensionId = String(formData.get("suspension_id") ?? "");

  const supabase = await createClient();
  const utilisateur = await verifierAdmin(supabase);

  const admin = creerClientAdmin();
  if (!admin) {
    retourSuspensions("erreur", "Levée indisponible (SUPABASE_SERVICE_ROLE_KEY manquante).");
  }

  const { data: suspension } = await admin
    .from("suspensions")
    .update({ levee_le: new Date().toISOString(), levee_par: utilisateur.id })
    .eq("id", suspensionId)
    .is("levee_le", null)
    .select("profile_id, profil:profiles!suspensions_profile_id_fkey(pseudo)")
    .maybeSingle();
  if (!suspension) {
    retourSuspensions("erreur", "Suspension introuvable ou déjà levée.");
  }

  const { error } = await admin.auth.admin.updateUserById(suspension.profile_id, { ban_duration: "none" });

  await notifierJoueur(
    suspension.profile_id,
    "Suspension levée — Najarena",
    "Ton compte Najarena est de nouveau actif",
    `<p>Tu peux te reconnecter et t'inscrire aux tournois.</p>
     <p><a href="${URL_SITE}/connexion">Se connecter</a></p>`,
  );

  const pseudo = suspension.profil?.pseudo ?? "Le joueur";
  if (error) {
    retourSuspensions("erreur", `Suspension levée pour ${pseudo}, mais sa connexion est encore bloquée : relance la levée depuis Supabase (Authentication > Users).`);
  }
  retourSuspensions("message", `Suspension levée pour ${pseudo}.`);
}

// ---------- Modération (02/10/2026, audit N27) ----------
// Un texte retenu par la modération automatique (message, motif de litige)
// est relu ici. Un message validé est remis à son destinataire, prévenu
// comme pour tout nouveau message ; rejeté, il ne l'est jamais.
export async function traiterSignalement(formData: FormData) {
  const signalementId = String(formData.get("signalement_id") ?? "");
  const valide = formData.get("decision") === "valider";

  const supabase = await createClient();
  await verifierAdmin(supabase);

  const { data: contexte, error } = await supabase.rpc("traiter_signalement", {
    p_signalement_id: signalementId,
    p_valide: valide,
  });
  if (error) {
    redirect(`/admin?erreur=${encodeURIComponent("Ce texte a déjà été traité.")}#moderation`);
  }

  const admin = creerClientAdmin();
  if (valide && contexte === "message" && admin) {
    const { data: signalement } = await admin
      .from("moderation_signalements")
      .select("cible_id")
      .eq("id", signalementId)
      .maybeSingle();
    const { data: message } = signalement
      ? await admin
          .from("messages")
          .select("conversation_id, expediteur_id, conversation:conversations(profile_a, profile_b)")
          .eq("id", signalement.cible_id)
          .maybeSingle()
      : { data: null };
    if (message?.conversation) {
      const destinataire =
        message.conversation.profile_a === message.expediteur_id
          ? message.conversation.profile_b
          : message.conversation.profile_a;
      await notifierJoueur(
        destinataire,
        "Nouveau message — Najarena",
        "Tu as reçu un nouveau message sur Najarena",
        `<p><a href="${URL_SITE}/moi/messages/${message.conversation_id}">Voir la conversation</a></p>`,
      );
    }
  }

  redirect(`/admin?message=${encodeURIComponent(valide ? "Texte validé." : "Texte rejeté.")}#moderation`);
}
