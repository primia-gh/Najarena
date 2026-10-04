"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { formaterDate } from "@/lib/tournois";
import { instantDepuisSaisieParis } from "@/lib/tournois-auto/creneaux";
import { libelleEquipe } from "@/lib/cinq-contre-cinq";

// Scrims vérifiés entre équipes (03/10/2026, audit N22). Toutes les règles
// sont appliquées par la base (proposer_scrim, repondre_scrim,
// annuler_scrim) ; ces actions traduisent ses refus et préviennent les
// joueurs concernés.

const MESSAGES_REFUS: Record<string, string> = {
  CAPITAINE_REQUIS: "Seul le capitaine de l'équipe peut proposer un scrim.",
  EQUIPE_INTROUVABLE: "Cette équipe n'existe plus.",
  SCRIM_CONTRE_SOI: "Une équipe ne joue pas de scrim contre elle-même.",
  EQUIPE_AUTRE_JEU: "Ces deux équipes ne jouent pas au même jeu.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : pas de scrim pour l'instant.",
  DATE_SCRIM_INVALIDE: "Choisis une date entre 15 minutes et 30 jours à partir de maintenant.",
  FORMAT_INVALIDE: "Un scrim se joue en Bo1 ou en Bo3.",
  COMPTE_RIOT_REQUIS: "Lie et vérifie ton compte Riot : c'est lui qui fixe la région du scrim.",
  ALIGNEMENT_DE_CINQ: "Choisis exactement cinq joueurs, toi compris.",
  CAPITAINE_DANS_ALIGNEMENT: "En tant que capitaine, tu fais partie des cinq joueurs alignés.",
  JOUEUR_HORS_EQUIPE: "Un des joueurs choisis n'est pas (ou plus) membre de l'équipe.",
  ALIGNEMENT_COMPTE_RIOT:
    "Chacun des cinq joueurs doit avoir un compte Riot vérifié dans la région du scrim : c'est ce qui permet de retrouver le résultat.",
  ALIGNEMENT_SUSPENDU: "Un des joueurs choisis a un compte suspendu.",
  SCRIM_DEJA_PROPOSE: "Un scrim attend déjà une réponse entre ces deux équipes.",
  TROP_DE_SCRIMS: "Ton équipe a déjà trois propositions de scrim en attente.",
  SCRIM_INTROUVABLE: "Ce scrim n'existe pas.",
  NON_DESTINATAIRE: "Seul le capitaine de l'équipe invitée peut répondre.",
  SCRIM_DEJA_TRAITE: "Ce scrim a déjà reçu une réponse.",
  SCRIM_EXPIRE: "L'heure prévue est passée : propose une nouvelle date.",
  ALIGNEMENT_ADVERSE_INVALIDE:
    "L'alignement de l'équipe qui propose n'est plus valable (un joueur est parti ou n'a plus de compte vérifié) : elle doit refaire sa proposition.",
  JOUEUR_DANS_LES_DEUX_EQUIPES: "Un joueur ne peut pas jouer pour les deux équipes.",
  AUCUN_ARBITRE: "Aucun arbitre n'est disponible pour l'instant : réessaie plus tard.",
  NON_AUTORISE: "Seuls les capitaines des deux équipes peuvent annuler ce scrim.",
  SCRIM_NON_ANNULABLE: "Ce scrim ne peut plus être annulé.",
};

function messageRefus(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS[code] : parDefaut;
}

function pageEquipe(slug: string, cle: "erreur" | "message", texte: string): string {
  return `/equipe/${slug}?${cle}=${encodeURIComponent(texte)}#scrims`;
}

export async function proposerScrim(formData: FormData) {
  const equipeId = String(formData.get("equipe_id") ?? "");
  const adversaireId = String(formData.get("adversaire_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const bestOf = Number(formData.get("best_of") ?? 1);
  const prevuLe = instantDepuisSaisieParis(String(formData.get("prevu_le") ?? ""));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }
  if (!prevuLe) {
    redirect(pageEquipe(slug, "erreur", "Date du scrim invalide."));
  }

  const { error } = await supabase.rpc("proposer_scrim", {
    p_equipe_id: equipeId,
    p_adversaire_id: adversaireId,
    p_prevu_le: prevuLe.toISOString(),
    p_best_of: bestOf,
    p_joueurs: formData.getAll("joueurs").map((v) => String(v)),
  });
  if (error) {
    redirect(pageEquipe(slug, "erreur", messageRefus(error.message, "Impossible de proposer ce scrim pour l'instant.")));
  }

  // Le capitaine invité est prévenu (push et Discord).
  const { data: equipes } = await supabase
    .from("teams")
    .select("id, nom, tag, slug, capitaine_id")
    .in("id", [equipeId, adversaireId]);
  const nous = equipes?.find((e) => e.id === equipeId);
  const eux = equipes?.find((e) => e.id === adversaireId);
  if (nous && eux) {
    await envoyerRappel(
      eux.capitaine_id,
      `Proposition de scrim — ${libelleEquipe(nous.tag, nous.nom)}`,
      `${libelleEquipe(nous.tag, nous.nom)} propose un scrim à ton équipe le ${formaterDate(prevuLe.toISOString())} (heure de Paris), en Bo${bestOf}. Accepte avec tes cinq joueurs ou refuse depuis la page de l'équipe.`,
      `${URL_SITE}/equipe/${eux.slug}#scrims`,
    );
  }

  redirect(pageEquipe(slug, "message", "Scrim proposé : le capitaine adverse est prévenu."));
}

export async function repondreScrim(formData: FormData) {
  const scrimId = String(formData.get("scrim_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const accepte = formData.get("reponse") === "accepter";

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: scrim } = await supabase
    .from("scrims")
    .select(
      "prevu_le, equipe_a:teams!scrims_equipe_a_id_fkey(nom, tag, slug, capitaine_id), equipe_b:teams!scrims_equipe_b_id_fkey(nom, tag)",
    )
    .eq("id", scrimId)
    .maybeSingle();

  const { data: slugScrim, error } = await supabase.rpc("repondre_scrim", {
    p_scrim_id: scrimId,
    p_accepte: accepte,
    p_joueurs: accepte ? formData.getAll("joueurs").map((v) => String(v)) : undefined,
  });
  if (error) {
    redirect(pageEquipe(slug, "erreur", messageRefus(error.message, "Impossible de répondre à ce scrim pour l'instant.")));
  }

  const a = scrim?.equipe_a;
  const b = scrim?.equipe_b;
  if (!accepte) {
    if (a && b) {
      await envoyerRappel(
        a.capitaine_id,
        `Scrim refusé — ${libelleEquipe(b.tag, b.nom)}`,
        `${libelleEquipe(b.tag, b.nom)} ne peut pas jouer le scrim proposé. Propose une autre date, ou une autre équipe.`,
        `${URL_SITE}/equipe/${a.slug}#scrims`,
      );
    }
    redirect(pageEquipe(slug, "message", "Proposition refusée."));
  }

  // Les dix joueurs alignés sont prévenus, avec le lien du scrim.
  if (slugScrim && scrim && a && b) {
    const { data: tournoi } = await supabase.from("tournaments").select("id").eq("slug", slugScrim).maybeSingle();
    const { data: alignes } = tournoi
      ? await supabase.from("alignements").select("profile_id").eq("tournament_id", tournoi.id)
      : { data: [] };
    await Promise.all(
      (alignes ?? []).map((j) =>
        envoyerRappel(
          j.profile_id,
          `Scrim confirmé — ${libelleEquipe(a.tag, a.nom)} contre ${libelleEquipe(b.tag, b.nom)}`,
          `Rendez-vous le ${formaterDate(scrim.prevu_le)} (heure de Paris). Les Riot ID des dix joueurs et les règles sont dans la salle de match.`,
          `${URL_SITE}/lol/tournois/${slugScrim}#ton-match`,
        ),
      ),
    );
  }

  redirect(slugScrim ? `/lol/tournois/${slugScrim}` : pageEquipe(slug, "message", "Scrim accepté."));
}

export async function annulerScrim(formData: FormData) {
  const scrimId = String(formData.get("scrim_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: scrim } = await supabase
    .from("scrims")
    .select(
      "statut, equipe_a:teams!scrims_equipe_a_id_fkey(nom, tag, slug, capitaine_id), equipe_b:teams!scrims_equipe_b_id_fkey(nom, tag, slug, capitaine_id)",
    )
    .eq("id", scrimId)
    .maybeSingle();

  const { error } = await supabase.rpc("annuler_scrim", { p_scrim_id: scrimId });
  if (error) {
    redirect(pageEquipe(slug, "erreur", messageRefus(error.message, "Impossible d'annuler ce scrim pour l'instant.")));
  }

  // L'autre capitaine est prévenu d'un scrim accepté qui n'aura pas lieu.
  if (scrim?.statut === "accepte" && scrim.equipe_a && scrim.equipe_b) {
    const nousSommesA = scrim.equipe_a.capitaine_id === userData.user.id;
    const nous = nousSommesA ? scrim.equipe_a : scrim.equipe_b;
    const eux = nousSommesA ? scrim.equipe_b : scrim.equipe_a;
    await envoyerRappel(
      eux.capitaine_id,
      `Scrim annulé — ${libelleEquipe(nous.tag, nous.nom)}`,
      `${libelleEquipe(nous.tag, nous.nom)} a annulé le scrim prévu contre ton équipe.`,
      `${URL_SITE}/equipe/${eux.slug}#scrims`,
    );
  }

  redirect(pageEquipe(slug, "message", "Scrim annulé."));
}
