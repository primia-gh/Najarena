"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cloturerTournoi } from "@/lib/classement-actions";
import { envoyerRappel, notifierJoueur, notifierDiscord, URL_SITE } from "@/lib/notifications";
import { formaterDate } from "@/lib/tournois";
import { construireBracket, ordonnerParRating } from "@/lib/bracket-construction";
import { echapperDiscord, echapperHtml } from "@/lib/echappement";
import { matchsOuverts, prevenirMatchOuvert, prevenirSuitesDouble, suiteSuisse } from "@/lib/apres-verdict";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";
import { annoncerVainqueur } from "@/lib/recit-tournoi-serveur";
import { formerEquipes } from "@/lib/agents-libres";
import { ROLES, type Role } from "@/lib/roles";
import { instantDepuisSaisieParis } from "@/lib/tournois-auto/creneaux";
import { messageRefusModification } from "@/lib/modifier-tournoi";
import { lireNiveau, MESSAGE_NIVEAU_ORGANISATEUR } from "@/lib/niveau-tournoi";
import { messageModeration } from "@/lib/moderation";

async function verifierOrganisateur(supabase: Awaited<ReturnType<typeof createClient>>, tournamentId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("id, nom, slug, capacite, organisateur_id, statut, format, type_bracket")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournoi || tournoi.organisateur_id !== userData.user.id) {
    redirect("/moi");
  }

  return { supabase, tournoi, utilisateur: userData.user };
}

export async function confirmerInscription(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const supabase = await createClient();
  const { tournoi } = await verifierOrganisateur(supabase, tournamentId);

  const { data: inscription, error: erreurConfirmation } = await supabase
    .from("registrations")
    .update({ statut: "confirme", confirme_le: new Date().toISOString() })
    .eq("id", registrationId)
    .eq("tournament_id", tournamentId)
    // Un joueur désinscrit ne se réinscrit que lui-même.
    .neq("statut", "retire")
    .select("profile_id")
    .maybeSingle();

  if (erreurConfirmation?.message.includes("COMPTE_SUSPENDU")) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Ce joueur est suspendu : son inscription ne peut pas être confirmée.")}`,
    );
  }

  // Tournoi réservé aux membres : revérifié au check-in (17/10/2026).
  if (erreurConfirmation?.message.includes("RESERVE_MEMBRES")) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Ce joueur (ou un joueur de cette équipe) n'est plus membre de la communauté, ou n'a plus son adresse d'école vérifiée : sa présence ne peut pas être confirmée.")}`,
    );
  }

  // Tournoi par niveau (19/11/2026) : revérifié à la confirmation.
  if (erreurConfirmation?.message.includes("NIVEAU_HORS_TOURNOI")) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(MESSAGE_NIVEAU_ORGANISATEUR)}`,
    );
  }

  // Tournoi 5v5 (audit N21) : la base refuse une équipe à moins de cinq.
  if (erreurConfirmation?.message.includes("ALIGNEMENT_INCOMPLET")) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Cette équipe n'a pas cinq joueurs alignés : son capitaine doit compléter l'alignement.")}`,
    );
  }

  if (inscription) {
    const { data: t } = await supabase.from("tournaments").select("nom, slug").eq("id", tournoi.id).maybeSingle();
    if (t) {
      await notifierJoueur(
        inscription.profile_id,
        `Inscription confirmée — ${t.nom}`,
        "Ta présence est confirmée",
        `<p>L'organisateur a confirmé ton inscription au tournoi <strong>${echapperHtml(t.nom)}</strong>.</p>
         <p><a href="${URL_SITE}/lol/tournois/${t.slug}">Voir le tournoi</a></p>`,
      );
    }
  }

  redirect(`/moi/organisation/${tournamentId}`);
}

export async function marquerAbsent(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const supabase = await createClient();
  await verifierOrganisateur(supabase, tournamentId);

  const { error } = await supabase
    .from("registrations")
    .update({ statut: "absent" })
    .eq("id", registrationId)
    .eq("tournament_id", tournamentId)
    .neq("statut", "retire");

  if (error?.message.includes("CHECKIN_PAS_OUVERT")) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        "Le check-in n'est pas encore ouvert : ce joueur n'a pas pu confirmer sa présence. Tu pourras le marquer absent une fois le check-in ouvert.",
      )}`,
    );
  }

  redirect(`/moi/organisation/${tournamentId}`);
}

// Agents libres (audit N23) : équipes de cinq équilibrées par rating et par
// rôle (src/lib/agents-libres.ts), inscrites par la base, qui revérifie
// tout (former_equipes_agents_libres). Chaque agent est prévenu, placé ou
// non. Renvoie le nombre d'équipes formées, ou null en cas d'erreur.
async function formerEquipesAgentsLibres(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tournoi: { id: string; nom: string; slug: string; capacite: number },
): Promise<number | null> {
  const [{ data: agents }, { count: inscrites }] = await Promise.all([
    supabase
      .from("agents_libres")
      .select("profile_id, role, rating_a_inscription")
      .eq("tournament_id", tournoi.id)
      .eq("statut", "confirme")
      .order("inscrit_le", { ascending: true }),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournoi.id)
      .neq("statut", "retire"),
  ]);
  if (!agents || agents.length === 0) return 0;

  const { equipes, restants } = formerEquipes(
    agents.map((a) => ({
      profileId: a.profile_id,
      rating: a.rating_a_inscription,
      role: ROLES.includes(a.role as Role) ? (a.role as Role) : null,
    })),
    tournoi.capacite - (inscrites ?? 0),
  );
  if (equipes.length > 0) {
    const { error } = await supabase.rpc("former_equipes_agents_libres", {
      p_tournament_id: tournoi.id,
      p_equipes: equipes,
    });
    if (error) return null;
  }

  const lien = `${URL_SITE}/lol/tournois/${tournoi.slug}`;
  const { data: profils } = await supabase
    .from("profiles")
    .select("id, pseudo")
    .in("id", equipes.flat());
  const pseudo = (id: string) => profils?.find((p) => p.id === id)?.pseudo ?? "un joueur";
  await Promise.all([
    ...equipes.flatMap((equipe) =>
      equipe.map((id) =>
        envoyerRappel(
          id,
          `Ton équipe est formée — ${tournoi.nom}`,
          `Tu joues avec ${equipe
            .filter((autre) => autre !== id)
            .map(pseudo)
            .join(", ")}. Capitaine : ${pseudo(equipe[0])}. Les Riot ID de tous sont dans la salle de match.`,
          `${lien}#ton-match`,
        ),
      ),
    ),
    ...restants.map((id) =>
      envoyerRappel(
        id,
        `Pas d'équipe cette fois — ${tournoi.nom}`,
        "Il n'y avait pas assez d'agents libres pour former une équipe complète de plus (ou plus de place dans le bracket). Inscris-toi au prochain tournoi 5v5, ou cherche une équipe parmi les coéquipiers.",
        `${URL_SITE}/lol/coequipiers`,
      ),
    ),
  ]);
  return equipes.length;
}

export async function genererBracket(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const supabase = await createClient();
  const { tournoi } = await verifierOrganisateur(supabase, tournamentId);

  const { count: nbMatchsExistants } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  if (nbMatchsExistants && nbMatchsExistants > 0) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Le bracket a déjà été généré.")}`,
    );
  }

  // Format suisse (19/11/2026) : la base fixe le nombre de rondes et
  // apparie la première ; les suivantes se créent au fil des verdicts.
  if (tournoi.type_bracket === "suisse") {
    const { error } = await supabase.rpc("demarrer_suisse", { p_tournament: tournamentId });
    if (error) {
      redirect(
        `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
          error.message.includes("PAS_ASSEZ_DE_JOUEURS")
            ? "Il faut au moins 2 joueurs confirmés pour lancer le tournoi."
            : error.message.includes("TOURNOI_DEJA_LANCE")
              ? "Le tournoi est déjà lancé."
              : "Impossible de lancer le tournoi pour l'instant.",
        )}`,
      );
    }
    await Promise.all((await matchsOuverts(tournamentId)).map((m) => prevenirMatchOuvert(m.matchId)));
    redirect(`/moi/organisation/${tournamentId}`);
  }

  // Double élimination (20/11/2026) : la base crée les deux tableaux et la
  // grande finale, place les joueurs et résout les exemptions.
  if (tournoi.type_bracket === "double_elim") {
    const { error } = await supabase.rpc("demarrer_double_elim", { p_tournament: tournamentId });
    if (error) {
      redirect(
        `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
          error.message.includes("PAS_ASSEZ_DE_JOUEURS")
            ? "Il faut au moins 4 joueurs confirmés pour lancer une double élimination."
            : error.message.includes("TOURNOI_DEJA_LANCE")
              ? "Le tournoi est déjà lancé."
              : "Impossible de lancer le tournoi pour l'instant.",
        )}`,
      );
    }
    await Promise.all((await matchsOuverts(tournamentId)).map((m) => prevenirMatchOuvert(m.matchId)));
    redirect(`/moi/organisation/${tournamentId}`);
  }

  // Tournoi 5v5 (audit N23) : les agents libres confirmés forment d'abord
  // leurs équipes, inscrites comme les autres.
  if (tournoi.format === "5v5") {
    const formees = await formerEquipesAgentsLibres(supabase, tournoi);
    if (formees === null) {
      redirect(
        `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
          "Impossible de former les équipes d'agents libres pour l'instant. Réessaie.",
        )}`,
      );
    }
  }

  const { data: confirmes } = await supabase
    .from("registrations")
    .select("profile_id, rating_a_inscription")
    .eq("tournament_id", tournamentId)
    .eq("statut", "confirme");

  // Têtes de série selon le rating à l'inscription (le tirage au sort ne
  // départage plus que les égalités et les joueurs sans rating).
  const joueurs = ordonnerParRating(
    (confirmes ?? []).map((c) => ({ profileId: c.profile_id, rating: c.rating_a_inscription })),
  );

  if (joueurs.length < 2) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        "Il faut au moins 2 joueurs confirmés pour générer le bracket.",
      )}`,
    );
  }

  // Une exemption refusée par la base n'arrête pas le lancement, mais
  // l'organisateur en est averti (contrôle de sécurité du 20/11/2026 :
  // avant, l'erreur passait inaperçue et le match restait bloqué).
  let exemptionsRefusees = 0;
  const { ok } = await construireBracket(
    supabase,
    tournamentId,
    tournoi.capacite,
    joueurs,
    async (matchId, gagnantId) => {
      const { error } = await supabase.rpc("enregistrer_verdict_manuel", {
        p_match_id: matchId,
        p_gagnant_id: gagnantId,
        p_motif: "Bye — moins d'inscrits confirmés que de places dans le bracket.",
      });
      if (error) exemptionsRefusees += 1;
    },
  );

  if (!ok) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        "Impossible de générer le bracket pour l'instant.",
      )}`,
    );
  }

  await supabase.from("tournaments").update({ statut: "en_cours" }).eq("id", tournamentId);

  // Les joueurs des matchs déjà ouverts sont prévenus (push et Discord, avec
  // le bouton « Je suis prêt ») — jusqu'ici, seuls les tours suivants
  // l'étaient.
  await Promise.all((await matchsOuverts(tournamentId)).map((m) => prevenirMatchOuvert(m.matchId)));

  if (exemptionsRefusees > 0) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        "Le bracket est lancé, mais une exemption n'a pas pu être enregistrée : un match reste en attente avec un seul joueur. Écris-nous (adresse dans les mentions légales) pour le débloquer.",
      )}`,
    );
  }
  redirect(`/moi/organisation/${tournamentId}`);
}

export async function enregistrerResultat(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const gagnantId = String(formData.get("gagnant_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  const supabase = await createClient();

  // Le tournoi est celui du match décidé, jamais celui envoyé par le
  // formulaire (audit sécurité du 10/10/2026, M3) : sinon un organisateur
  // pouvait trancher un match de son tournoi A en indiquant son tournoi B,
  // et faire clôturer B (« terminé » sur sa fiche publique, fausse annonce
  // du vainqueur sur Discord).
  const { data: matchVise } = await supabase.from("matches").select("tournament_id").eq("id", matchId).maybeSingle();
  if (!matchVise) {
    redirect("/moi");
  }
  const tournamentId = matchVise.tournament_id;
  await verifierOrganisateur(supabase, tournamentId);

  if (!motif) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        "Un motif est obligatoire pour un verdict manuel.",
      )}`,
    );
  }

  const { error } = await supabase.rpc("enregistrer_verdict_manuel", {
    p_match_id: matchId,
    p_gagnant_id: gagnantId,
    p_motif: motif,
  });

  if (error) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        error.message.includes("ADVERSAIRE_ATTENDU")
          ? "Ce match attend encore son second joueur : tu pourras le trancher quand il sera arrivé."
          : error.message.includes("MATCH_DEJA_DECIDE")
            ? "Ce match est déjà décidé."
            : (messageModeration(error.message) ?? "Impossible d'enregistrer ce résultat pour l'instant."),
      )}`,
    );
  }

  // La finale (aucun match_suivant_id) vient d'être décidée : le tournoi
  // est terminé, on déclenche la clôture du classement (docs/moteur-
  // resultats.md §4 — jamais match par match, seulement à la clôture).
  const { data: matchDecide } = await supabase
    .from("matches")
    .select(
      "match_suivant_id, match_perdant_suivant_id, tour, tournament:tournaments(nom, slug, format, type_bracket), match_participants(profile_id, profile:profiles(pseudo))",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (matchDecide?.tournament) {
    // 5v5 (audit N21) : l'équipe derrière chaque capitaine, et ses cinq joueurs.
    const equipes =
      matchDecide.tournament.format === "5v5" ? await chargerEquipesDesTournois(supabase, [tournamentId]) : null;
    const equipe = (capitaineId: string) => equipes?.get(cleEquipe(tournamentId, capitaineId));
    const gagnant = matchDecide.match_participants.find((p) => p.profile_id === gagnantId);
    const nomGagnant = equipe(gagnantId)?.libelle ?? gagnant?.profile?.pseudo ?? "le vainqueur";
    // Une notification par participant, indépendantes les unes des autres —
    // lancées en parallèle plutôt qu'en série (correctif du 13/09/2026,
    // même logique que sur l'accueil).
    await Promise.all(
      matchDecide.match_participants.flatMap((p) => {
        const aGagne = p.profile_id === gagnantId;
        return (equipe(p.profile_id)?.joueurs ?? [p.profile_id]).map((id) =>
          notifierJoueur(
            id,
            `Résultat enregistré — ${matchDecide.tournament!.nom}`,
            aGagne ? "Tu as gagné ce match" : "Résultat de ton match",
            `<p>${aGagne ? "Tu remportes" : `${echapperHtml(nomGagnant)} remporte`} ce match du tournoi <strong>${echapperHtml(matchDecide.tournament!.nom)}</strong>.</p>
             <p>Motif : ${echapperHtml(motif)}</p>
             <p><a href="${URL_SITE}/lol/tournois/${matchDecide.tournament!.slug}">Voir le bracket</a></p>`,
          ),
        );
      }),
    );
  }

  // Format suisse (19/11/2026) : ronde suivante ou fin, jamais de finale.
  if (matchDecide?.tournament?.type_bracket === "suisse") {
    await suiteSuisse(tournamentId, matchDecide.tour);
  } else if (matchDecide?.tournament?.type_bracket === "double_elim") {
    await prevenirSuitesDouble([matchDecide.match_suivant_id, matchDecide.match_perdant_suivant_id]);
  } else if (matchDecide?.match_suivant_id) {
    await prevenirMatchOuvert(matchDecide.match_suivant_id);
  }

  if (matchDecide && matchDecide.match_suivant_id === null && matchDecide.tournament?.type_bracket !== "suisse") {
    await cloturerTournoi(tournamentId);
    // Le récit dit que la finale a été tranchée à la main (hors classement).
    await annoncerVainqueur(tournamentId, gagnantId);
  }

  redirect(`/moi/organisation/${tournamentId}`);
}

export async function resoudreLitige(formData: FormData) {
  const disputeId = String(formData.get("dispute_id") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();

  const supabase = await createClient();

  // Tournoi lu depuis le litige, pas depuis le formulaire (même raison que
  // pour enregistrerResultat) : la notification au joueur nomme le bon
  // tournoi.
  const { data: litigeVise } = await supabase
    .from("disputes")
    .select("match:matches(tournament_id)")
    .eq("id", disputeId)
    .maybeSingle();
  if (!litigeVise?.match) {
    redirect("/moi");
  }
  const tournamentId = litigeVise.match.tournament_id;
  const { utilisateur } = await verifierOrganisateur(supabase, tournamentId);

  if (!resolution) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("La résolution ne peut pas être vide.")}`,
    );
  }

  const { data: litige, error: erreurLitige } = await supabase
    .from("disputes")
    .update({ resolution, resolu_par: utilisateur.id, resolu_le: new Date().toISOString() })
    .eq("id", disputeId)
    .select("ouvert_par")
    .maybeSingle();

  // Résolution modérée par la base (texte public, 21/11/2026).
  if (erreurLitige) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        messageModeration(erreurLitige.message) ?? "Impossible d'enregistrer la résolution pour l'instant.",
      )}`,
    );
  }

  if (litige) {
    const { data: t } = await supabase.from("tournaments").select("nom, slug").eq("id", tournamentId).maybeSingle();
    if (t) {
      await notifierJoueur(
        litige.ouvert_par,
        `Litige résolu — ${t.nom}`,
        "L'organisateur a répondu à ton litige",
        `<p>Résolution : ${echapperHtml(resolution)}</p>
         <p><a href="${URL_SITE}/lol/tournois/${t.slug}">Voir le tournoi</a></p>`,
      );
    }
  }

  redirect(`/moi/organisation/${tournamentId}`);
}

// Publication d'un brouillon (28/09/2026, audit M7) : jusqu'ici, un tournoi
// créé en brouillon ne pouvait jamais être publié. Ses réglages restent
// ceux de la création (figés par la base) : une date déjà passée impose
// d'en créer un nouveau.
export async function publierTournoi(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const supabase = await createClient();
  await verifierOrganisateur(supabase, tournamentId);

  const { data: t } = await supabase
    .from("tournaments")
    .select("nom, slug, statut, capacite, region, debute_le")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!t || t.statut !== "brouillon") {
    redirect(`/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Ce tournoi n'est pas un brouillon.")}`);
  }

  if (new Date(t.debute_le).getTime() <= Date.now()) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent(
        "La date de début est passée : crée un nouveau tournoi avec une date future.",
      )}`,
    );
  }

  const { error } = await supabase.from("tournaments").update({ statut: "ouvert" }).eq("id", tournamentId);
  if (error) {
    redirect(`/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Publication impossible pour l'instant.")}`);
  }

  await notifierDiscord(
    `📣 Nouveau tournoi ouvert — **${echapperDiscord(t.nom)}** (${t.capacite} joueurs, ${echapperDiscord(t.region)}), débute le ${formaterDate(t.debute_le)}.\n${URL_SITE}/lol/tournois/${t.slug}`,
  );

  redirect(`/moi/organisation/${tournamentId}?message=${encodeURIComponent("Tournoi publié : les inscriptions sont ouvertes.")}`);
}

// Modification avant la première inscription (19/11/2026, audit M7) : nom,
// capacité, Best-of, serveur, dates, niveau. La base (modifier_tournoi) vérifie
// tout — propriétaire, statut, aucune inscription, mêmes règles qu'à la
// création, modération du nom — et repose la date de publication si la
// date de début change. Personne n'est inscrit : personne à prévenir.
export async function modifierTournoi(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const supabase = await createClient();
  const { tournoi } = await verifierOrganisateur(supabase, tournamentId);

  const page = `/moi/organisation/${tournamentId}`;
  const debuteLe = instantDepuisSaisieParis(String(formData.get("debute_le") ?? ""));
  const checkinOuvreLe = instantDepuisSaisieParis(String(formData.get("checkin_ouvre_le") ?? ""));
  if (!debuteLe || !checkinOuvreLe) {
    redirect(`${page}?erreur=${encodeURIComponent("Dates invalides.")}#retour`);
  }

  const niveau = lireNiveau(formData.get("niveau_min"), formData.get("niveau_max"), tournoi.format);
  if (!niveau.ok) {
    redirect(`${page}?erreur=${encodeURIComponent(niveau.erreur)}#retour`);
  }

  const { error } = await supabase.rpc("modifier_tournoi", {
    p_tournament_id: tournamentId,
    p_nom: String(formData.get("nom") ?? "").slice(0, 200),
    p_capacite: Number(formData.get("capacite")),
    p_best_of: Number(formData.get("best_of") ?? 1),
    p_region: String(formData.get("region") ?? ""),
    p_debute_le: debuteLe.toISOString(),
    p_checkin_ouvre_le: checkinOuvreLe.toISOString(),
    p_rating_min: niveau.min,
    p_rating_max: niveau.max,
  });
  if (error) {
    redirect(`${page}?erreur=${encodeURIComponent(messageRefusModification(error.message))}#retour`);
  }

  redirect(`${page}?message=${encodeURIComponent("Tournoi modifié.")}#retour`);
}

// Annulation par l'organisateur (28/09/2026, audit M7), tant que le bracket
// n'est pas lancé. Les inscrits sont prévenus.
export async function annulerTournoi(formData: FormData) {
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const supabase = await createClient();
  const { tournoi } = await verifierOrganisateur(supabase, tournamentId);

  if (!["brouillon", "ouvert", "checkin"].includes(tournoi.statut)) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Un tournoi commencé ou terminé ne peut plus être annulé.")}`,
    );
  }

  const { error } = await supabase.from("tournaments").update({ statut: "annule" }).eq("id", tournamentId);
  if (error) {
    redirect(`/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("Annulation impossible pour l'instant.")}`);
  }

  const [{ data: t }, { data: inscrits }] = await Promise.all([
    supabase.from("tournaments").select("nom, slug").eq("id", tournamentId).maybeSingle(),
    supabase
      .from("registrations")
      .select("profile_id")
      .eq("tournament_id", tournamentId)
      .in("statut", ["inscrit", "confirme"]),
  ]);

  if (t) {
    await Promise.all(
      (inscrits ?? []).map((i) =>
        notifierJoueur(
          i.profile_id,
          `Tournoi annulé — ${t.nom}`,
          "Ce tournoi est annulé",
          `<p>L'organisateur a annulé le tournoi <strong>${echapperHtml(t.nom)}</strong>.</p>
           <p><a href="${URL_SITE}/lol/tournois">Voir les autres tournois</a></p>`,
        ),
      ),
    );
  }

  redirect(`/moi/organisation/${tournamentId}?message=${encodeURIComponent("Tournoi annulé : les inscrits ont été prévenus.")}`);
}
