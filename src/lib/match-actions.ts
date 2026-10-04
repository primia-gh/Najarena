"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apresVerdict } from "@/lib/apres-verdict";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { DELAI_FORFAIT_MINUTES, limiteForfait } from "@/lib/forfait";
import { heureParis } from "@/lib/tournois-auto/creneaux";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";

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

  const { data: match } = await supabase
    .from("matches")
    .select(
      "tournament_id, tournament:tournaments(nom, slug, format), match_participants(profile_id, pret_le, profile:profiles(pseudo))",
    )
    .eq("id", matchId)
    .maybeSingle();
  const moi = match?.match_participants.find((p) => p.profile_id === userData.user.id);
  const adversaire = match?.match_participants.find((p) => p.profile_id !== userData.user.id);

  if (adversaire?.pret_le) {
    redirect(`${page}?message=${encodeURIComponent("Vous êtes prêts tous les deux : lancez la partie.")}#ton-match`);
  }

  // Première déclaration : l'adversaire est prévenu (push et Discord), une
  // fois. En 5v5 (audit N21), toute l'équipe adverse : son capitaine seul
  // peut la déclarer prête, mais chacun doit savoir que l'heure tourne.
  if (nouveau && match?.tournament && moi?.pret_le && adversaire) {
    const equipes =
      match.tournament.format === "5v5" ? await chargerEquipesDesTournois(supabase, [match.tournament_id]) : null;
    const monEquipe = equipes?.get(cleEquipe(match.tournament_id, moi.profile_id));
    const equipeAdverse = equipes?.get(cleEquipe(match.tournament_id, adversaire.profile_id));
    const limite = heureParis(limiteForfait(moi.pret_le).toISOString());
    await Promise.all(
      (equipeAdverse?.joueurs ?? [adversaire.profile_id]).map((id) =>
        envoyerRappel(
          id,
          `${monEquipe?.libelle ?? moi.profile?.pseudo ?? "Ton adversaire"} est prêt — ${match.tournament!.nom}`,
          equipeAdverse
            ? `Ton capitaine doit déclarer l'équipe prête dans la salle de match avant ${limite} (heure de Paris), sinon elle perd ce match par forfait.`
            : `Déclare-toi prêt dans la salle de match avant ${limite} (heure de Paris), sinon tu perds ce match par forfait.`,
          `${URL_SITE}/lol/tournois/${match.tournament!.slug}#ton-match`,
        ),
      ),
    );
  }

  redirect(
    `${page}?message=${encodeURIComponent(
      `Tu es prêt. Si ton adversaire ne l'est pas dans les ${DELAI_FORFAIT_MINUTES} minutes, il perd par forfait (aucun point pour personne).`,
    )}#ton-match`,
  );
}
