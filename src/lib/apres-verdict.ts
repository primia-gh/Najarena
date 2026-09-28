// Ce qui suit un verdict posé sans organisateur (partie retrouvée dans
// l'historique Riot, défaite reconnue par le perdant) : prévenir les deux
// joueurs, et si c'était la finale, clôturer le tournoi (calcul Glicko-2,
// docs/moteur-resultats.md §4) puis annoncer le vainqueur. Serveur
// uniquement : lit la base avec le client service_role, après que
// l'appelant a lui-même écrit le verdict par une fonction contrôlée.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { notifierDiscord, notifierJoueur, URL_SITE } from "@/lib/notifications";
import { cloturerTournoi } from "@/lib/classement-actions";
import { echapperDiscord, echapperHtml } from "@/lib/echappement";

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

  // Aucun match suivant : c'était la finale.
  if (m.match_suivant_id === null) {
    await cloturerTournoi(m.tournament_id);
    const nomGagnant = m.match_participants.find((p) => p.profile_id === gagnantId)?.profile?.pseudo ?? "le vainqueur";
    await notifierDiscord(`🏆 **${echapperDiscord(nomGagnant)}** remporte **${echapperDiscord(tournoi.nom)}**.\n${URL_SITE}/lol/tournois/${tournoi.slug}`);
  }
}
