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
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";
import { boutonPret } from "@/lib/suites-joueur";

export async function apresVerdict(matchId: string, gagnantId: string, explication: string): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;

  const { data: m } = await admin
    .from("matches")
    .select(
      "tournament_id, match_suivant_id, tournament:tournaments(nom, slug, format, nature), match_participants(profile_id, profile:profiles(pseudo))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (!m?.tournament) return;
  const tournoi = m.tournament;

  // 5v5 (audit N21) : les cinq joueurs alignés de chaque équipe, pas
  // seulement les capitaines du bracket.
  const equipes = tournoi.format === "5v5" ? await chargerEquipesDesTournois(admin, [m.tournament_id]) : null;
  const destinataires = m.match_participants.flatMap((p) =>
    (equipes?.get(cleEquipe(m.tournament_id, p.profile_id))?.joueurs ?? [p.profile_id]).map((id) => ({
      id,
      gagne: p.profile_id === gagnantId,
    })),
  );

  // Une notification par joueur, indépendantes : en parallèle.
  await Promise.all(
    destinataires.map((d) =>
      notifierJoueur(
        d.id,
        `Résultat enregistré — ${tournoi.nom}`,
        d.gagne ? "Victoire enregistrée" : "Résultat de ton match",
        `<p>${echapperHtml(explication)}</p>
         <p><a href="${URL_SITE}/lol/tournois/${tournoi.slug}">Voir le bracket</a></p>`,
      ),
    ),
  );

  // Fin d'un duel (défi, arène) : bouton « Proposer une revanche » dans
  // Discord (idée en réserve n°10). Le résultat est déjà parti par e-mail
  // et push : message Discord seul.
  if (tournoi.nature === "defi") {
    await Promise.all(
      destinataires.map((d) =>
        envoyerRappel(
          d.id,
          `Duel terminé — ${tournoi.nom}`,
          d.gagne ? "Victoire enregistrée. Ton adversaire voudra peut-être sa revanche." : "Défaite enregistrée. Une revanche ?",
          `${URL_SITE}/lol/tournois/${tournoi.slug}`,
          {
            push: false,
            boutons: [{ action: "revanche", cible: m.tournament_id, libelle: "Proposer une revanche" }],
          },
        ),
      ),
    );
  }

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
    .select(
      "statut, tournament_id, tournament:tournaments(nom, slug, format), match_participants(profile_id, profile:profiles(pseudo))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (!suivant?.tournament || suivant.statut !== "en_cours" || suivant.match_participants.length !== 2) return;

  const { nom, slug, format } = suivant.tournament;
  // 5v5 (audit N21) : les dix joueurs alignés sont prévenus.
  const equipes = format === "5v5" ? await chargerEquipesDesTournois(admin, [suivant.tournament_id]) : null;
  const equipe = (capitaineId: string) => equipes?.get(cleEquipe(suivant.tournament_id, capitaineId));
  await Promise.all(
    suivant.match_participants.flatMap((p) => {
      const autre = suivant.match_participants.find((q) => q.profile_id !== p.profile_id);
      const adversaire = (autre && equipe(autre.profile_id)?.libelle) ?? autre?.profile?.pseudo ?? "ton adversaire";
      const texte = equipes
        ? `Équipe adverse : ${adversaire}. Les Riot ID des dix joueurs, qui crée la partie et les règles sont dans la salle de match.`
        : `Adversaire : ${adversaire}. Son Riot ID, qui crée la partie et les règles sont dans la salle de match.`;
      // Bouton « Je suis prêt » au joueur du bracket (le capitaine en 5v5).
      return (equipe(p.profile_id)?.joueurs ?? [p.profile_id]).map((id) =>
        envoyerRappel(id, `Ton match est ouvert — ${nom}`, texte, `${URL_SITE}/lol/tournois/${slug}#ton-match`, {
          boutons: id === p.profile_id ? [boutonPret(matchId)] : [],
        }),
      );
    }),
  );
}

/**
 * Matchs ouverts d'un tournoi (deux joueurs connus, en cours, pas encore de
 * verdict définitif) : ceux du premier tour au lancement du bracket, et ceux
 * qu'un bye a déjà complétés.
 */
export async function matchsOuverts(tournoiId: string): Promise<{ matchId: string; joueurs: string[] }[]> {
  const admin = creerClientAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("matches")
    .select("id, match_participants(profile_id), match_verdicts(est_definitif)")
    .eq("tournament_id", tournoiId)
    .eq("statut", "en_cours");
  return (data ?? [])
    .filter((m) => m.match_participants.length === 2 && !m.match_verdicts.some((v) => v.est_definitif))
    .map((m) => ({ matchId: m.id, joueurs: m.match_participants.map((p) => p.profile_id) }));
}
