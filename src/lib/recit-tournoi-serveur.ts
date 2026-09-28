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

export async function annoncerVainqueur(tournamentId: string, gagnantId: string): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;

  const [{ data: tournoi }, { data: matchs }, { data: departs }] = await Promise.all([
    admin.from("tournaments").select("nom, slug, best_of").eq("id", tournamentId).maybeSingle(),
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
  if (!tournoi) return;

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
        pseudo: p.profile?.pseudo ?? "un joueur",
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
    chances: (g, p) => probabiliteVictoire(etat(g), etat(p)),
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
