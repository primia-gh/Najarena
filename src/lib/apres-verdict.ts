// Ce qui suit un verdict posé sans organisateur (partie retrouvée dans
// l'historique Riot, défaite reconnue par le perdant) : prévenir les deux
// joueurs, et si c'était la finale, clôturer le tournoi (calcul Glicko-2,
// docs/moteur-resultats.md §4) puis annoncer le vainqueur. Serveur
// uniquement : lit la base avec le client service_role, après que
// l'appelant a lui-même écrit le verdict par une fonction contrôlée.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { envoyerRappel, notifierJoueur, URL_SITE } from "@/lib/notifications";
import { cloturerTournoi } from "@/lib/classement-actions";
import { echapperHtml } from "@/lib/echappement";
import { annoncerVainqueur } from "@/lib/recit-tournoi-serveur";

export async function apresVerdict(matchId: string, gagnantId: string, explication: string): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;

  const { data: m } = await admin
    .from("matches")
    .select(
      "tournament_id, match_suivant_id, tournament:tournaments(nom, slug), match_participants(profile_id, profile:profiles(pseudo))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (!m?.tournament) return;
  const tournoi = m.tournament;

  // Une notification par joueur, indépendantes : en parallèle.
  await Promise.all(
    m.match_participants.map((p) =>
      notifierJoueur(
        p.profile_id,
        `Résultat enregistré — ${tournoi.nom}`,
        p.profile_id === gagnantId ? "Victoire enregistrée" : "Résultat de ton match",
        `<p>${echapperHtml(explication)}</p>
         <p><a href="${URL_SITE}/lol/tournois/${tournoi.slug}">Voir le bracket</a></p>`,
      ),
    ),
  );

  if (m.match_suivant_id) {
    await prevenirMatchOuvert(m.match_suivant_id);
  }

  // Aucun match suivant : c'était la finale.
  if (m.match_suivant_id === null) {
    await cloturerTournoi(m.tournament_id);
    await annoncerVainqueur(m.tournament_id, gagnantId);
  }
}

/**
 * Le match suivant vient de s'ouvrir (ses deux joueurs sont connus) :
 * rappel push + message privé Discord aux deux, avec le lien de la salle de
 * match (28/09/2026, audit N6). Sans effet tant qu'un seul joueur est
 * qualifié : c'est le verdict qui qualifie le second qui prévient.
 */
export async function prevenirMatchOuvert(matchId: string): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;

  const { data: suivant } = await admin
    .from("matches")
    .select("statut, tournament:tournaments(nom, slug), match_participants(profile_id, profile:profiles(pseudo))")
    .eq("id", matchId)
    .maybeSingle();
  if (!suivant?.tournament || suivant.statut !== "en_cours" || suivant.match_participants.length !== 2) return;

  const { nom, slug } = suivant.tournament;
  await Promise.all(
    suivant.match_participants.map((p) => {
      const adversaire =
        suivant.match_participants.find((q) => q.profile_id !== p.profile_id)?.profile?.pseudo ?? "ton adversaire";
      return envoyerRappel(
        p.profile_id,
        `Ton match est ouvert — ${nom}`,
        `Adversaire : ${adversaire}. Son Riot ID, qui crée la partie et les règles sont dans la salle de match.`,
        `${URL_SITE}/lol/tournois/${slug}#ton-match`,
      );
    }),
  );
}
