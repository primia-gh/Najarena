"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apresAbandonSansMatch, apresVerdict, derniereRonde } from "@/lib/apres-verdict";
import { DELAI_FORFAIT_MINUTES } from "@/lib/forfait";
import { apresDeclarationPret } from "@/lib/suites-joueur";

// Refus de la fonction reconnaitre_defaite (docs/schema.sql).
const MESSAGES_REFUS: Record<string, string> = {
  NON_PARTICIPANT: "Tu ne joues pas ce match.",
  ADVERSAIRE_ABSENT: "Ton adversaire n'est pas encore connu.",
  MATCH_DEJA_DECIDE: "Ce match a déjà un résultat.",
  DEFAITE_DEJA_RECONNUE: "Une défaite a déjà été reconnue pour ce match.",
  MATCH_INTROUVABLE: "Ce match n'existe pas.",
};

// « J'ai perdu ce match » (28/09/2026, audit N3) : le perdant débloque son
// adversaire sans attendre un organisateur. Sa parole ne compte jamais au
// classement — seule la partie retrouvée chez Riot le fait, et la
// recherche lui laisse encore 20 minutes (src/lib/rapprochement.ts).
export async function reconnaitreDefaite(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const page = `/lol/tournois/${slug}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: issue, error } = await supabase.rpc("reconnaitre_defaite", { p_match_id: matchId });

  if (error) {
    const code = Object.keys(MESSAGES_REFUS).find((c) => error.message.includes(c));
    redirect(
      `${page}?erreur=${encodeURIComponent(code ? MESSAGES_REFUS[code] : "Impossible d'enregistrer ta défaite pour l'instant.")}`,
    );
  }

  if (issue === "tranche") {
    // Match déjà en litige : le verdict vient d'être posé par la base.
    const { data: adversaire } = await supabase
      .from("match_participants")
      .select("profile_id")
      .eq("match_id", matchId)
      .neq("profile_id", userData.user.id)
      .maybeSingle();
    if (adversaire) {
      await apresVerdict(
        matchId,
        adversaire.profile_id,
        "Défaite reconnue par le perdant : le match est tranché sur sa parole (verdict manuel, hors classement).",
      );
    }
    redirect(`${page}?message=${encodeURIComponent("Défaite enregistrée : le match est tranché, ton adversaire avance.")}`);
  }

  redirect(
    `${page}?message=${encodeURIComponent(
      "Défaite enregistrée. Si la partie est retrouvée dans l'historique Riot d'ici 20 minutes, le résultat comptera au classement ; sinon, le match sera tranché sur ta parole.",
    )}`,
  );
}

// Refus de la fonction declarer_pret (docs/schema.sql).
const MESSAGES_REFUS_PRET: Record<string, string> = {
  NON_PARTICIPANT: "Tu ne joues pas ce match.",
  ADVERSAIRE_ABSENT: "Ton adversaire n'est pas encore connu.",
  MATCH_NON_OUVERT: "Ce match n'est plus à jouer.",
  MATCH_INTROUVABLE: "Ce match n'existe pas.",
};

// « Je suis prêt » (28/09/2026, audit N4) : l'adversaire est prévenu et a
// 15 minutes pour se déclarer prêt à son tour, sinon il perd par forfait
// (appliqué par la tâche de recherche, src/lib/rapprochement.ts).
export async function declarerPret(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const page = `/lol/tournois/${slug}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: nouveau, error } = await supabase.rpc("declarer_pret", { p_match_id: matchId });

  if (error) {
    const code = Object.keys(MESSAGES_REFUS_PRET).find((c) => error.message.includes(c));
    redirect(
      `${page}?erreur=${encodeURIComponent(code ? MESSAGES_REFUS_PRET[code] : "Impossible de te déclarer prêt pour l'instant.")}#ton-match`,
    );
  }

  // Première déclaration : l'adversaire est prévenu (push et Discord, avec
  // son bouton « Je suis prêt »), une fois — suites-joueur.ts, commun avec
  // les boutons Discord.
  const { adversairePret } = await apresDeclarationPret(matchId, userData.user.id, Boolean(nouveau));
  if (adversairePret) {
    redirect(`${page}?message=${encodeURIComponent("Vous êtes prêts tous les deux : lancez la partie.")}#ton-match`);
  }

  redirect(
    `${page}?message=${encodeURIComponent(
      `Tu es prêt. Si ton adversaire ne l'est pas dans les ${DELAI_FORFAIT_MINUTES} minutes, il perd par forfait (aucun point pour personne).`,
    )}#ton-match`,
  );
}

// Refus de la fonction abandonner_suisse (docs/schema.sql).
const MESSAGES_REFUS_ABANDON: Record<string, string> = {
  PAS_UN_TOURNOI_SUISSE: "L'abandon en cours de route n'existe qu'au format suisse.",
  TOURNOI_PAS_EN_COURS: "Ce tournoi n'est pas en cours.",
  NON_PARTICIPANT: "Tu ne joues pas ce tournoi.",
  DEJA_ABANDONNE: "Tu as déjà abandonné ce tournoi.",
};

// Abandon officiel d'un tournoi suisse (19/11/2026, revu le 20/11) : la
// base ne m'apparie plus ; mon match en cours vaut « défaite reconnue »
// (la partie lue chez Riot reste prioritaire 20 minutes, sinon la tâche de
// recherche le donne à l'adversaire), sauf s'il était déjà en litige :
// tranché tout de suite. Ensuite, comme après tout verdict.
export async function abandonnerTournoiSuisse(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const supabase = await createClient();
  // Adresse de retour lue en base, jamais dans le formulaire.
  const { data: tournoi } = await supabase.from("tournaments").select("slug").eq("id", tournamentId).maybeSingle();
  const page = tournoi ? `/lol/tournois/${tournoi.slug}` : "/lol/tournois";
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const rondeAvant = await derniereRonde(tournamentId);
  const { data: matchTranche, error } = await supabase.rpc("abandonner_suisse", { p_tournament: tournamentId });
  if (error) {
    const code = Object.keys(MESSAGES_REFUS_ABANDON).find((c) => error.message.includes(c));
    redirect(
      `${page}?erreur=${encodeURIComponent(code ? MESSAGES_REFUS_ABANDON[code] : "Impossible d'enregistrer ton abandon pour l'instant.")}`,
    );
  }

  if (matchTranche) {
    const { data: adversaire } = await supabase
      .from("match_participants")
      .select("profile_id")
      .eq("match_id", matchTranche)
      .neq("profile_id", userData.user.id)
      .maybeSingle();
    if (adversaire) {
      await apresVerdict(
        matchTranche,
        adversaire.profile_id,
        "Ton adversaire a abandonné le tournoi pendant votre match en litige : le match t'est donné (décision manuelle, hors classement Najarena).",
      );
    }
  } else {
    await apresAbandonSansMatch(tournamentId, rondeAvant);
  }

  redirect(
    `${page}?message=${encodeURIComponent(
      "Abandon enregistré : tu n'es plus apparié. Si tu avais un match en cours, il est considéré comme perdu, sauf si la partie est retrouvée chez Riot dans les 20 minutes : son vrai résultat compte alors.",
    )}`,
  );
}
