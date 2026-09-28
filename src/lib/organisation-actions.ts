"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cloturerTournoi } from "@/lib/classement-actions";
import { notifierJoueur, notifierDiscord, URL_SITE } from "@/lib/notifications";
import { formaterDate } from "@/lib/tournois";
import { construireBracket, ordonnerParRating } from "@/lib/bracket-construction";
import { echapperDiscord, echapperHtml } from "@/lib/echappement";

async function verifierOrganisateur(supabase: Awaited<ReturnType<typeof createClient>>, tournamentId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("id, capacite, organisateur_id, statut")
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

  await supabase
    .from("registrations")
    .update({ statut: "absent" })
    .eq("id", registrationId)
    .eq("tournament_id", tournamentId)
    .neq("statut", "retire");

  redirect(`/moi/organisation/${tournamentId}`);
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

  const { ok } = await construireBracket(
    supabase,
    tournamentId,
    tournoi.capacite,
    joueurs,
    async (matchId, gagnantId) => {
      await supabase.rpc("enregistrer_verdict_manuel", {
        p_match_id: matchId,
        p_gagnant_id: gagnantId,
        p_motif: "Bye — moins d'inscrits confirmés que de places dans le bracket.",
      });
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

  redirect(`/moi/organisation/${tournamentId}`);
}

export async function enregistrerResultat(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const gagnantId = String(formData.get("gagnant_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  const supabase = await createClient();
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
        "Impossible d'enregistrer ce résultat pour l'instant.",
      )}`,
    );
  }

  // La finale (aucun match_suivant_id) vient d'être décidée : le tournoi
  // est terminé, on déclenche la clôture du classement (docs/moteur-
  // resultats.md §4 — jamais match par match, seulement à la clôture).
  const { data: matchDecide } = await supabase
    .from("matches")
    .select("match_suivant_id, tournament:tournaments(nom, slug), match_participants(profile_id, profile:profiles(pseudo))")
    .eq("id", matchId)
    .maybeSingle();

  if (matchDecide?.tournament) {
    const gagnant = matchDecide.match_participants.find((p) => p.profile_id === gagnantId);
    const nomGagnant = gagnant?.profile?.pseudo ?? "le vainqueur";
    // Une notification par participant, indépendantes les unes des autres —
    // lancées en parallèle plutôt qu'en série (correctif du 13/09/2026,
    // même logique que sur l'accueil).
    await Promise.all(
      matchDecide.match_participants.map((p) => {
        const aGagne = p.profile_id === gagnantId;
        return notifierJoueur(
          p.profile_id,
          `Résultat enregistré — ${matchDecide.tournament!.nom}`,
          aGagne ? "Tu as gagné ce match" : "Résultat de ton match",
          `<p>${aGagne ? "Tu remportes" : `${echapperHtml(nomGagnant)} remporte`} ce match du tournoi <strong>${echapperHtml(matchDecide.tournament!.nom)}</strong>.</p>
           <p>Motif : ${echapperHtml(motif)}</p>
           <p><a href="${URL_SITE}/lol/tournois/${matchDecide.tournament!.slug}">Voir le bracket</a></p>`,
        );
      }),
    );
  }

  if (matchDecide && matchDecide.match_suivant_id === null) {
    await cloturerTournoi(tournamentId);
    if (matchDecide.tournament) {
      const nomGagnant =
        matchDecide.match_participants.find((p) => p.profile_id === gagnantId)?.profile?.pseudo ??
        "le vainqueur";
      await notifierDiscord(
        `🏆 **${echapperDiscord(nomGagnant)}** remporte **${echapperDiscord(matchDecide.tournament.nom)}** (verdict manuel — ${echapperDiscord(motif)}).\n${URL_SITE}/lol/tournois/${matchDecide.tournament.slug}`,
      );
    }
  }

  redirect(`/moi/organisation/${tournamentId}`);
}

export async function resoudreLitige(formData: FormData) {
  const disputeId = String(formData.get("dispute_id") ?? "");
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();

  const supabase = await createClient();
  const { utilisateur } = await verifierOrganisateur(supabase, tournamentId);

  if (!resolution) {
    redirect(
      `/moi/organisation/${tournamentId}?erreur=${encodeURIComponent("La résolution ne peut pas être vide.")}`,
    );
  }

  const { data: litige } = await supabase
    .from("disputes")
    .update({ resolution, resolu_par: utilisateur.id, resolu_le: new Date().toISOString() })
    .eq("id", disputeId)
    .select("ouvert_par")
    .maybeSingle();

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
    `📣 Nouveau tournoi ouvert — **${echapperDiscord(t.nom)}** (${t.capacite} joueurs, ${t.region}), débute le ${formaterDate(t.debute_le)}.\n${URL_SITE}/lol/tournois/${t.slug}`,
  );

  redirect(`/moi/organisation/${tournamentId}?message=${encodeURIComponent("Tournoi publié : les inscriptions sont ouvertes.")}`);
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
