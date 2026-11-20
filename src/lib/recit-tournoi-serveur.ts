// Annonce du vainqueur sur Discord, avec le récit du tournoi (audit N26).
// Serveur uniquement (client service_role) : appelée après la clôture de
// la finale, par la recherche Riot, la défaite reconnue ou le verdict de
// l'organisateur.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { notifierDiscord, URL_SITE } from "@/lib/notifications";
import { echapperDiscord } from "@/lib/echappement";
import { probabiliteVictoire } from "@/lib/glicko2";
import { ETAT_DE_DEPART, type EtatRating } from "@/lib/estimations";
import { recitTournoi, type MatchRecit } from "@/lib/recit-tournoi";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";
import { recitSuisse } from "@/lib/suisse";

export async function annoncerVainqueur(tournamentId: string, gagnantId: string): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;

  const [{ data: tournoi }, { data: matchs }, { data: departs }] = await Promise.all([
    admin.from("tournaments").select("nom, slug, best_of, format, nature, type_bracket, rondes").eq("id", tournamentId).maybeSingle(),
    admin
      .from("matches")
      .select(
        "tour, match_participants(profile_id, score, profile:profiles(pseudo)), match_verdicts(niveau, gagnant_id, est_definitif)",
      )
      .eq("tournament_id", tournamentId),
    admin
      .from("rating_events")
      .select("profile_id, rating_avant, rd_avant")
      .eq("tournament_id", tournamentId)
      .eq("motif", "tournoi"),
  ]);
  // Un scrim (audit N22) est un entraînement : rien à annoncer.
  if (!tournoi || tournoi.nature === "scrim") return;
  const lienTournoi = `${URL_SITE}/lol/tournois/${tournoi.slug}`;
  // Format suisse (19/11/2026) : le classement final, pas de finale.
  if (tournoi.type_bracket === "suisse") {
    const { data: classement } = await admin.rpc("classement_suisse", { p_tournament: tournamentId });
    const phrases = recitSuisse(tournoi.nom, tournoi.rondes, classement ?? []);
    if (phrases) await notifierDiscord(`🏆 ${phrases.map(echapperDiscord).join("\n")}\n${lienTournoi}`);
    return;
  }
  // Double élimination (20/11/2026) : le vainqueur de la grande finale.
  if (tournoi.type_bracket === "double_elim") {
    // La grande finale porte le plus grand numéro de tour.
    const finale = [...(matchs ?? [])].sort((a, b) => b.tour - a.tour)[0];
    const joueurs = new Set((matchs ?? []).flatMap((m) => m.match_participants.map((p) => p.profile_id))).size;
    const gagnant = finale?.match_participants.find((p) => p.profile_id === gagnantId)?.profile?.pseudo ?? "Un joueur";
    const finaliste = finale?.match_participants.find((p) => p.profile_id !== gagnantId)?.profile?.pseudo;
    await notifierDiscord(
      `🏆 ${echapperDiscord(
        `${gagnant} remporte ${tournoi.nom} en double élimination (${joueurs} joueurs)${finaliste ? `, en grande finale contre ${finaliste}` : ""}.`,
      )}
${lienTournoi}`,
    );
    return;
  }
  // 5v5 (audit N21) : chaque capitaine du bracket représente son équipe.
  const equipes = tournoi.format === "5v5" ? await chargerEquipesDesTournois(admin, [tournamentId]) : new Map();
  const nom = (id: string, pseudo: string | undefined) =>
    equipes.get(cleEquipe(tournamentId, id))?.libelle ?? pseudo ?? "un joueur";

  const etats = new Map<string, EtatRating>(
    (departs ?? []).map((d) => [d.profile_id, { rating: d.rating_avant, rd: d.rd_avant }]),
  );
  const etat = (id: string) => etats.get(id) ?? ETAT_DE_DEPART;

  const matchsRecit: MatchRecit[] = (matchs ?? []).map((m) => {
    const verdict = m.match_verdicts.find((v) => v.est_definitif);
    return {
      tour: m.tour,
      participants: m.match_participants.map((p) => ({
        id: p.profile_id,
        pseudo: nom(p.profile_id, p.profile?.pseudo),
        score: p.score,
      })),
      verdict: verdict ? { niveau: verdict.niveau, gagnantId: verdict.gagnant_id } : null,
    };
  });
  const joueurs = new Set(matchsRecit.flatMap((m) => m.participants.map((p) => p.id)));

  const recit = recitTournoi({
    nom: tournoi.nom,
    nbJoueurs: joueurs.size,
    bestOf: tournoi.best_of,
    matchs: matchsRecit,
    // Chances estimées d'après les ratings individuels : sans objet en 5v5.
    chances: tournoi.format === "5v5" ? undefined : (g, p) => probabiliteVictoire(etat(g), etat(p)),
    equipes: tournoi.format === "5v5",
  });

  const lien = `${URL_SITE}/lol/tournois/${tournoi.slug}`;
  if (recit) {
    await notifierDiscord(`🏆 ${recit.map(echapperDiscord).join("\n")}\n${lien}`);
    return;
  }
  // Récit impossible (données incomplètes) : l'annonce simple d'avant.
  const nomGagnant =
    matchsRecit.flatMap((m) => m.participants).find((p) => p.id === gagnantId)?.pseudo ?? "le vainqueur";
  await notifierDiscord(`🏆 **${echapperDiscord(nomGagnant)}** remporte **${echapperDiscord(tournoi.nom)}**.\n${lien}`);
}
