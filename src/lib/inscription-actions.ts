"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Messages affichés pour chaque refus de la fonction s_inscrire_tournoi
// (docs/schema.sql). Les vérifications elles-mêmes (tournoi ouvert, places
// restantes, doublon) se font dans la base, en une seule opération sous
// verrou : un appel direct à la base, sans passer par cette action, est
// refusé de la même façon, et deux inscriptions simultanées ne peuvent
// plus dépasser la capacité (audit du 27/09/2026, E1).
const MESSAGES_REFUS: Record<string, string> = {
  INSCRIPTIONS_FERMEES: "Les inscriptions sont fermées pour ce tournoi.",
  TOURNOI_COMPLET: "Ce tournoi est complet.",
  DEJA_INSCRIT: "Tu es déjà inscrit à ce tournoi.",
  TOURNOI_INTROUVABLE: "Ce tournoi n'existe pas.",
  // Compte Riot vérifié de la région du tournoi exigé (28/09/2026, audit
  // E2) : sans lui, aucun résultat ne peut être retrouvé automatiquement.
  COMPTE_RIOT_REQUIS: "Lie et vérifie ton compte Riot avant de t'inscrire : c'est lui qui permet de retrouver tes résultats.",
  REGION_DIFFERENTE: "Ce tournoi se joue sur une autre région que ton compte Riot vérifié.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : tu ne peux pas t'inscrire aux tournois.",
  TOURNOI_PAR_EQUIPES: "Ce tournoi se joue en équipe : c'est le capitaine qui inscrit son équipe.",
  // Tournoi réservé aux membres d'une communauté (04/10/2026).
  RESERVE_MEMBRES:
    "Ce tournoi est réservé aux membres de sa communauté (aux membres vérifiés, pour une école) : rejoins-la depuis sa page avant de t'inscrire.",
};

// Tournois 5v5 (03/10/2026, audit N21) : refus de s_inscrire_equipe et de
// modifier_alignement (docs/schema.sql).
const MESSAGES_REFUS_EQUIPE: Record<string, string> = {
  INSCRIPTIONS_FERMEES: "Les inscriptions sont fermées pour ce tournoi.",
  TOURNOI_COMPLET: "Ce tournoi est complet.",
  DEJA_INSCRIT: "Ton équipe est déjà inscrite à ce tournoi.",
  TOURNOI_INTROUVABLE: "Ce tournoi n'existe pas.",
  TOURNOI_EN_SOLO: "Ce tournoi se joue en 1v1 : chaque joueur s'inscrit lui-même.",
  CAPITAINE_REQUIS: "Seul le capitaine de l'équipe peut l'inscrire.",
  EQUIPE_AUTRE_JEU: "Cette équipe n'est pas une équipe League of Legends.",
  ALIGNEMENT_DE_CINQ: "Choisis exactement cinq joueurs, toi compris.",
  CAPITAINE_DANS_ALIGNEMENT: "En tant que capitaine, tu fais partie des cinq joueurs alignés.",
  JOUEUR_HORS_EQUIPE: "Un des joueurs choisis n'est pas (ou plus) membre de l'équipe.",
  ALIGNEMENT_COMPTE_RIOT:
    "Chacun des cinq joueurs doit avoir lié et vérifié son compte Riot, dans la région du tournoi : c'est ce qui permet de retrouver le résultat.",
  ALIGNEMENT_SUSPENDU: "Un des joueurs choisis a un compte suspendu.",
  JOUEUR_DEJA_ALIGNE: "Un des joueurs choisis joue déjà pour une autre équipe dans ce tournoi.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : tu ne peux pas inscrire ton équipe.",
  ALIGNEMENT_FIGE: "Le bracket est lancé : l'alignement ne change plus.",
  EQUIPE_NON_INSCRITE: "Ton équipe n'est pas inscrite à ce tournoi.",
  RESERVE_MEMBRES:
    "Ce tournoi est réservé aux membres de sa communauté (aux membres vérifiés, pour une école) : chacun des cinq joueurs doit en faire partie.",
};

function lireJoueurs(formData: FormData): string[] {
  return formData.getAll("joueurs").map((v) => String(v));
}

function messageRefusEquipe(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS_EQUIPE).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS_EQUIPE[code] : parDefaut;
}

// Inscription d'une équipe par son capitaine, avec ses cinq joueurs. Toutes
// les règles sont vérifiées par la base, sous verrou du tournoi.
export async function inscrireEquipe(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const teamId = String(formData.get("team_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const page = `/lol/tournois/${slug}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("s_inscrire_equipe", {
    p_tournament_id: tournamentId,
    p_team_id: teamId,
    p_joueurs: lireJoueurs(formData),
  });

  if (error) {
    redirect(
      `${page}?erreur=${encodeURIComponent(messageRefusEquipe(error.message, "Impossible d'inscrire ton équipe pour l'instant."))}`,
    );
  }

  redirect(
    `${page}?message=${encodeURIComponent("Équipe inscrite. Pense au check-in : c'est toi qui le fais pour l'équipe.")}`,
  );
}

// Le capitaine change ses cinq joueurs, jusqu'au lancement du bracket.
export async function modifierAlignement(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const page = `/lol/tournois/${slug}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("modifier_alignement", {
    p_tournament_id: tournamentId,
    p_joueurs: lireJoueurs(formData),
  });

  if (error) {
    redirect(
      `${page}?erreur=${encodeURIComponent(messageRefusEquipe(error.message, "Impossible de modifier l'alignement pour l'instant."))}`,
    );
  }

  redirect(`${page}?message=${encodeURIComponent("Alignement enregistré.")}`);
}

export async function sInscrireATournoi(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("s_inscrire_tournoi", { p_tournament_id: tournamentId });

  if (error) {
    const code = Object.keys(MESSAGES_REFUS).find((c) => error.message.includes(c));
    const message = code ? MESSAGES_REFUS[code] : "Impossible de s'inscrire pour l'instant.";
    redirect(`/lol/tournois/${slug}?erreur=${encodeURIComponent(message)}`);
  }

  redirect(`/lol/tournois/${slug}`);
}

// Désinscription (28/09/2026, audit M7) : possible tant que le tournoi n'a
// pas commencé. La base libère la place et autorise une réinscription.
export async function seDesinscrire(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const page = `/lol/tournois/${slug}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: retiree, error } = await supabase.rpc("se_desinscrire", { p_tournament_id: tournamentId });

  if (error || !retiree) {
    const message = error?.message.includes("DESINSCRIPTION_FERMEE")
      ? "Le tournoi a commencé : la désinscription n'est plus possible."
      : "Aucune inscription active à retirer.";
    redirect(`${page}?erreur=${encodeURIComponent(message)}`);
  }

  redirect(`${page}?message=${encodeURIComponent("Tu es désinscrit : ta place est libérée.")}`);
}

// Agents libres (03/10/2026, audit N23) : un joueur sans équipe s'inscrit
// seul à un tournoi 5v5 ; son équipe est formée au lancement du bracket.
const MESSAGES_REFUS_AGENT: Record<string, string> = {
  INSCRIPTIONS_FERMEES: "Les inscriptions sont fermées pour ce tournoi.",
  TOURNOI_COMPLET: "Il n'y a plus de place pour des équipes d'agents libres dans ce tournoi.",
  TOURNOI_INTROUVABLE: "Ce tournoi n'existe pas.",
  TOURNOI_EN_SOLO: "Les agents libres ne concernent que les tournois 5v5.",
  ROLE_INVALIDE: "Rôle inconnu.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : tu ne peux pas t'inscrire aux tournois.",
  COMPTE_RIOT_REQUIS: "Lie et vérifie ton compte Riot avant de t'inscrire : c'est lui qui permet de retrouver tes résultats.",
  REGION_DIFFERENTE: "Ce tournoi se joue sur une autre région que ton compte Riot vérifié.",
  DEJA_DANS_UNE_EQUIPE: "Tu es déjà aligné dans une équipe de ce tournoi.",
  DEJA_INSCRIT: "Tu es déjà inscrit comme agent libre.",
  RESERVE_MEMBRES:
    "Ce tournoi est réservé aux membres de sa communauté (aux membres vérifiés, pour une école) : rejoins-la depuis sa page avant de t'inscrire.",
};

export async function inscrireAgentLibre(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const role = String(formData.get("role") ?? "");
  const page = `/lol/tournois/${slug}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("s_inscrire_agent_libre", {
    p_tournament_id: tournamentId,
    p_role: role || undefined,
  });
  if (error) {
    const code = Object.keys(MESSAGES_REFUS_AGENT).find((c) => error.message.includes(c));
    redirect(
      `${page}?erreur=${encodeURIComponent(code ? MESSAGES_REFUS_AGENT[code] : "Impossible de t'inscrire pour l'instant.")}`,
    );
  }

  redirect(
    `${page}?message=${encodeURIComponent("Tu es inscrit comme agent libre. Confirme ta présence au check-in : ton équipe sera formée au lancement du bracket.")}`,
  );
}

export async function quitterAgentsLibres(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const page = `/lol/tournois/${slug}`;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: retire, error } = await supabase.rpc("quitter_agents_libres", { p_tournament_id: tournamentId });
  if (error || !retire) {
    redirect(
      `${page}?erreur=${encodeURIComponent(
        error?.message.includes("DESINSCRIPTION_FERMEE")
          ? "Le tournoi a commencé : la désinscription n'est plus possible."
          : "Aucune inscription d'agent libre à retirer.",
      )}`,
    );
  }

  redirect(`${page}?message=${encodeURIComponent("Tu n'es plus inscrit comme agent libre.")}`);
}
