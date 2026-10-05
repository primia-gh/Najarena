// Rapprochement par historique — verdict de niveau 2 (docs/moteur-
// resultats.md §3). Retrouve, dans l'historique Riot des deux joueurs
// d'un match, la ou les parties officielles qui correspondent, et
// journalise le résultat. Ne consomme jamais l'API Riot depuis le
// navigateur (§6.2) — ce fichier n'est appelé que depuis du code serveur.
//
// Refonte du 28/09/2026 (audit du 27/09, E3 et E4) : séries Best-of 3/5
// (seule la première manche était lue), délai avant litige adapté au
// format, recherche poursuivie après le passage en litige, organisateur et
// joueurs prévenus du litige. Logique pure (séries, calendrier) dans
// src/lib/serie.ts.

import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import {
  trouverRegion,
  recupererIdsMatchsRecents,
  recupererDetailsMatch,
  recupererChronologieMatch,
  estEnPartie,
  type Continent,
  type DetailsMatchRiot,
  type ParticipantMatchRiot,
} from "@/lib/riot";
import { detailsPartie } from "@/lib/capture-partie";
import { DELAI_FORFAIT_MINUTES, forfaitAAppliquer } from "@/lib/forfait";
import { vainqueurClassique, type ConditionVictoire } from "@/lib/conditions-1v1";
import { alignementsDansLaPartie, type Alignements } from "@/lib/cinq-contre-cinq";
import { chargerEquipesDesTournois, cleEquipe, type EquipeInscrite } from "@/lib/equipes-tournoi";
import { envoyerRappel, notifierJoueur, URL_SITE } from "@/lib/notifications";
import { apresVerdict } from "@/lib/apres-verdict";
import { echapperHtml } from "@/lib/echappement";
import {
  deciderSerie,
  defaiteReconnueATrancher,
  doitChercher,
  doitPasserEnLitige,
  DUREE_MIN_SECONDES,
  QUEUE_ID_PERSONNALISEE,
  RECHERCHE_APRES_LITIGE_HEURES,
  type PartieSerie,
  type StatutRecherche,
} from "@/lib/serie";

interface PartieTrouvee extends PartieSerie {
  // Stats des deux participants et durée — déjà présentes dans la réponse
  // Riot lue pendant la recherche, capturées pour stats_match_joueur sans
  // appel supplémentaire.
  participantA: ParticipantMatchRiot;
  participantB: ParticipantMatchRiot;
  /** Tous les joueurs de la partie (stats des dix joueurs alignés en 5v5). */
  participants: ParticipantMatchRiot[];
  dureeSecondes: number;
  /** Version du jeu (patch), gardée pour le bilan du joueur. */
  versionJeu?: string;
}

interface SerieTrouvee {
  gagnantPuuid: string;
  parties: PartieTrouvee[];
}

// Détails de partie déjà demandés pendant ce passage de la tâche : deux
// matchs (ou les deux joueurs d'un même match) partagent souvent les mêmes
// parties, inutile de consommer deux fois le quota Riot.
type CacheDetails = Map<string, Promise<DetailsMatchRiot>>;

function detailsEnCache(cache: CacheDetails, matchId: string, continent: Continent): Promise<DetailsMatchRiot> {
  let details = cache.get(matchId);
  if (!details) {
    details = recupererDetailsMatch(matchId, continent);
    cache.set(matchId, details);
  }
  return details;
}

/**
 * Applique les critères de docs/moteur-resultats.md §3 à l'historique du
 * joueur A pour retrouver les parties jouées contre le joueur B depuis
 * l'ouverture du match, puis décide la série (Bo1, Bo3, Bo5). Null tant
 * qu'aucun joueur n'a atteint le nombre de victoires nécessaire.
 * En 5v5 (audit N21), A et B sont les capitaines, et `alignements` les
 * cinq joueurs inscrits de chaque équipe : la partie doit les réunir tous
 * les dix, chaque équipe de son côté.
 */
export async function trouverSerieCorrespondante(
  puuidA: string,
  puuidB: string,
  continent: Continent,
  ouvertureLe: Date,
  bestOf: number,
  unContreUn: boolean,
  cache: CacheDetails = new Map(),
  condition: ConditionVictoire = "nexus",
  alignements?: Alignements,
): Promise<SerieTrouvee | null> {
  const ids = await recupererIdsMatchsRecents(
    puuidA,
    continent,
    Math.floor(ouvertureLe.getTime() / 1000),
    QUEUE_ID_PERSONNALISEE,
  );

  // 1v1 classique (audit N5) : le vainqueur est lu dans la chronologie de
  // la partie (premier sang, première tour, 100 sbires), pas dans son issue.
  const classique = condition === "classique" && unContreUn;

  const parties: PartieTrouvee[] = [];
  for (const riotMatchId of ids) {
    const { info } = await detailsEnCache(cache, riotMatchId, continent);

    const participantA = info.participants.find((p) => p.puuid === puuidA);
    const participantB = info.participants.find((p) => p.puuid === puuidB);
    if (!participantA || !participantB) continue; // les deux puuid y figurent
    if (alignements) {
      if (!alignementsDansLaPartie(info.participants, alignements)) continue;
    } else if (unContreUn && info.participants.length !== 2) {
      // En 1v1, une partie personnalisée à dix entre amis ne compte pas.
      continue;
    }
    if (info.gameStartTimestamp < ouvertureLe.getTime()) continue; // postérieure à l'ouverture
    if (info.queueId !== QUEUE_ID_PERSONNALISEE) continue; // partie personnalisée

    let gagnantEstA: boolean;
    if (classique) {
      if (participantA.teamId === undefined || participantB.teamId === undefined) continue;
      const chronologie = await recupererChronologieMatch(riotMatchId, continent);
      const idA = chronologie.info.participants?.find((p) => p.puuid === puuidA)?.participantId;
      const idB = chronologie.info.participants?.find((p) => p.puuid === puuidB)?.participantId;
      if (idA === undefined || idB === undefined) continue;
      const issue = vainqueurClassique(
        chronologie,
        { participantId: idA, equipe: participantA.teamId },
        { participantId: idB, equipe: participantB.teamId },
      );
      // Aucune condition remplie, ou ordre impossible à établir : partie
      // non retenue — l'organisateur tranchera, jamais un vainqueur deviné.
      if (issue === null || issue === "ambigu") continue;
      gagnantEstA = issue.vainqueur === "A";
    } else {
      if (participantA.win === participantB.win) continue; // dans des camps opposés
      if (info.gameDuration < DUREE_MIN_SECONDES) continue; // au-delà du seuil de remake
      gagnantEstA = participantA.win;
    }

    parties.push({
      riotMatchId,
      debut: info.gameStartTimestamp,
      gagnantEstA,
      participantA,
      participantB,
      participants: info.participants,
      dureeSecondes: info.gameDuration,
      versionJeu: info.gameVersion,
    });
  }

  const serie = deciderSerie(parties, bestOf);
  if (!serie) return null;
  return { gagnantPuuid: serie.gagnantEstA ? puuidA : puuidB, parties: serie.parties };
}

interface CompteRapprochement {
  profile_id: string;
  puuid: string;
  region: string;
  verifie_le: string | null;
  game_id: number;
}

interface MatchCandidat {
  id: string;
  tournament_id: string;
  match_suivant_id: string | null;
  statut: string;
  demarre_le: string | null;
  defaite_reconnue_par: string | null;
  defaite_reconnue_le: string | null;
  tournament: {
    game_id: number;
    nom: string;
    slug: string;
    best_of: number;
    format: string;
    organisateur_id: string;
    condition_victoire: string;
    nature: string;
  } | null;
  match_participants: { profile_id: string; pret_le: string | null; profile: { pseudo: string } | null }[];
}

type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

async function enregistrerSerie(
  admin: ClientAdmin,
  m: MatchCandidat,
  serie: SerieTrouvee,
  compteA: CompteRapprochement,
  compteB: CompteRapprochement,
  // 5v5 : joueurs alignés de chaque équipe (puuid → profil), dont les
  // stats sont enregistrées comme celles des capitaines.
  equipes?: { a: Map<string, string>; b: Map<string, string> },
): Promise<boolean> {
  const gagnantId = serie.gagnantPuuid === compteA.puuid ? compteA.profile_id : compteB.profile_id;

  const { data: ecrit } = await admin.rpc("enregistrer_verdict_historique", {
    p_match_id: m.id,
    p_gagnant_id: gagnantId,
    // Toutes les manches de la série, dans l'ordre (une seule en Bo1).
    p_riot_match_id: serie.parties.map((p) => p.riotMatchId).join(","),
  });
  if (!ecrit) return false;

  // Stats de la manche décisive (stats « par partie » : revue de match et
  // moyennes du profil, src/lib/revue-match.ts). Best-effort : une erreur
  // ici ne doit jamais remettre en cause le verdict.
  const decisive = serie.parties[serie.parties.length - 1];
  const statA = decisive.participantA;
  const statB = decisive.participantB;
  const ligne = (profileId: string, stat: ParticipantMatchRiot, gagne: boolean) => ({
    match_id: m.id,
    profile_id: profileId,
    // Compte qui a joué ce match (comptes secondaires déclarés, audit N15).
    puuid: stat.puuid,
    champion: stat.championName,
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    cs: stat.totalMinionsKilled + stat.neutralMinionsKilled,
    or_gagne: stat.goldEarned,
    duree_secondes: decisive.dureeSecondes,
    gagne,
    // Bilan du joueur (05/10/2026) : objets, runes, sorts, dégâts, vision,
    // objectifs, patch — lus dans la même fiche, sans appel de plus.
    ...detailsPartie(stat, { versionJeu: decisive.versionJeu, debut: decisive.debut }),
  });
  const gagnantEstA = gagnantId === compteA.profile_id;
  const lignes = equipes
    ? decisive.participants.flatMap((stat) => {
        const deA = equipes.a.get(stat.puuid);
        const deB = equipes.b.get(stat.puuid);
        if (deA) return [ligne(deA, stat, gagnantEstA)];
        if (deB) return [ligne(deB, stat, !gagnantEstA)];
        return [];
      })
    : [ligne(compteA.profile_id, statA, gagnantEstA), ligne(compteB.profile_id, statB, !gagnantEstA)];
  await admin.from("stats_match_joueur").upsert(lignes);

  const manches = serie.parties.length > 1 ? ` (${serie.parties.length} manches)` : "";
  await apresVerdict(
    m.id,
    gagnantId,
    `La partie officielle${manches} a été retrouvée automatiquement dans l'historique Riot : ce résultat est vérifié.`,
  );
  return true;
}

// Défaite reconnue par le perdant et toujours pas de partie Riot après le
// délai d'attente : verdict de niveau 1 (hors classement), motif public.
async function trancherDefaiteReconnue(admin: ClientAdmin, m: MatchCandidat): Promise<boolean> {
  const { data: ecrit } = await admin.rpc("enregistrer_defaite_reconnue", { p_match_id: m.id });
  if (!ecrit) return false;
  const gagnant = m.match_participants.find((p) => p.profile_id !== m.defaite_reconnue_par);
  if (gagnant) {
    await apresVerdict(
      m.id,
      gagnant.profile_id,
      "Défaite reconnue par le perdant : la partie n'a pas été retrouvée dans l'historique Riot, le match est tranché sur sa parole (verdict manuel, hors classement).",
    );
  }
  return true;
}

// Forfait automatique (audit N4) : l'adversaire s'est dit prêt il y a plus
// de 15 minutes, ce joueur jamais. Garde-fou : si l'un des deux est en
// partie chez Riot à cet instant (il joue sans doute ce match), ou si on ne
// peut pas le savoir, rien n'est tranché — on réessaie au passage suivant.
async function appliquerForfait(
  admin: ClientAdmin,
  m: MatchCandidat,
  forfait: { absentId: string; presentId: string },
  comptes: Map<string, CompteRapprochement>,
  nom: (profileId: string) => string,
): Promise<boolean> {
  if (!m.tournament) return false;
  for (const profileId of [forfait.absentId, forfait.presentId]) {
    const compte = comptes.get(`${profileId}:${m.tournament.game_id}`);
    const region = compte ? trouverRegion(compte.region) : undefined;
    if (!compte || !region) return false;
    try {
      if (await estEnPartie(compte.puuid, region.plateforme)) return false;
    } catch {
      return false;
    }
  }

  const { data: gagnantId } = await admin.rpc("appliquer_forfait_absence", { p_match_id: m.id });
  if (!gagnantId) return false;

  const absent = nom(forfait.absentId);
  await apresVerdict(
    m.id,
    gagnantId,
    `Forfait : ${absent} ne s'est pas déclaré prêt dans les ${DELAI_FORFAIT_MINUTES} minutes suivant son adversaire. Verdict hors classement : aucun point pour personne.`,
  );
  return true;
}

async function passerEnLitige(admin: ClientAdmin, m: MatchCandidat, nom: (profileId: string) => string): Promise<void> {
  const { data: bascule } = await admin
    .from("matches")
    .update({ statut: "litige" })
    .eq("id", m.id)
    .eq("statut", "en_cours")
    .select("id");
  if (!bascule?.length || !m.tournament) return;

  const tournoi = m.tournament;
  const libelle = m.match_participants.map((p) => nom(p.profile_id)).join(" vs ");
  const lienTournoi = `${URL_SITE}/lol/tournois/${tournoi.slug}`;

  // Duel entre deux joueurs (audit N16) ou scrim entre deux équipes (N22) :
  // pas d'organisateur à déranger ; sans partie retrouvée dans les 24 h, le
  // match est annulé.
  if (tournoi.nature === "defi" || tournoi.nature === "scrim") {
    const scrim = tournoi.nature === "scrim";
    await Promise.all(
      m.match_participants.map((p) =>
        envoyerRappel(
          p.profile_id,
          `${scrim ? "Scrim" : "Duel"} sans résultat — ${tournoi.nom}`,
          scrim
            ? "Aucune partie retrouvée dans l'historique Riot. La recherche continue pendant 24 h : jouez la partie maintenant avec les dix joueurs inscrits, sinon le scrim sera annulé."
            : "Aucune partie retrouvée dans l'historique Riot. La recherche continue pendant 24 h : jouez la partie maintenant, sinon le défi sera annulé.",
          `${lienTournoi}#ton-match`,
        ),
      ),
    );
    return;
  }

  // L'organisateur tranche (CLAUDE.md §3 : en cas de doute, on escalade) —
  // jusqu'ici, rien ne le prévenait qu'un match l'attendait.
  await Promise.all([
    notifierJoueur(
      tournoi.organisateur_id,
      `Match en litige — ${tournoi.nom}`,
      "Un match attend ta décision",
      `<p>Aucune partie officielle n'a été retrouvée pour le match ${echapperHtml(libelle)}. La recherche continue pendant 24 h ; si les joueurs n'ont pas joué ou ne peuvent pas jouer, tranche depuis ton cockpit (verdict manuel, motif public).</p>
       <p><a href="${URL_SITE}/moi/organisation/${m.tournament_id}">Ouvrir le cockpit</a></p>`,
    ),
    ...m.match_participants.map((p) =>
      envoyerRappel(
        p.profile_id,
        `Résultat introuvable — ${tournoi.nom}`,
        "Aucune partie retrouvée dans l'historique Riot pour ton match. La recherche continue ; l'organisateur a été prévenu. Si la partie n'a pas eu lieu, jouez-la maintenant en partie personnalisée.",
        lienTournoi,
      ),
    ),
  ]);
}

/**
 * Tâche de recherche de résultats (docs/moteur-resultats.md §6), appelée
 * toutes les 5 minutes. Parcourt les matchs en cours (et en litige depuis
 * moins de 24 h) ; pour chacun, tente le rapprochement niveau 2. Passé le
 * délai du format sans résultat, le match passe en litige — jamais de
 * résultat inventé.
 *
 * Destinée à être appelée par un déclencheur planifié (voir
 * src/app/api/cron/recherche-resultats/route.ts) — jamais par le client.
 */
export async function traiterRechercheResultats(): Promise<{
  trouves: number;
  litiges: number;
  ignores: number;
}> {
  const supabase = await createClient();
  const admin = creerClientAdmin();
  if (!admin) {
    return { trouves: 0, litiges: 0, ignores: 0 };
  }

  const { data: candidatsData } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, match_suivant_id, statut, demarre_le, defaite_reconnue_par, defaite_reconnue_le, tournament:tournaments(game_id, nom, slug, best_of, format, organisateur_id, condition_victoire, nature), match_participants(profile_id, pret_le, profile:profiles(pseudo))",
    )
    .in("statut", ["en_cours", "litige"])
    .not("demarre_le", "is", null)
    // Un match en litige n'est plus cherché au-delà de 24 h (RECHERCHE_APRES_LITIGE_HEURES).
    .or(`statut.eq.en_cours,demarre_le.gte.${new Date(Date.now() - (RECHERCHE_APRES_LITIGE_HEURES + 1) * 3_600_000).toISOString()}`);

  const candidats = (candidatsData ?? []) as MatchCandidat[];

  // Tournois 5v5 (audit N21) : l'équipe et ses cinq joueurs alignés
  // derrière chaque capitaine du bracket.
  const equipes = await chargerEquipesDesTournois(
    supabase,
    Array.from(new Set(candidats.filter((m) => m.tournament?.format === "5v5").map((m) => m.tournament_id))),
  );
  const equipeDe = (m: MatchCandidat, profileId: string): EquipeInscrite | undefined =>
    m.tournament?.format === "5v5" ? equipes.get(cleEquipe(m.tournament_id, profileId)) : undefined;
  const nomDans = (m: MatchCandidat) => (profileId: string) =>
    equipeDe(m, profileId)?.libelle ??
    m.match_participants.find((p) => p.profile_id === profileId)?.profile?.pseudo ??
    "Joueur inconnu";

  // Un seul aller-retour pour tous les comptes Riot des matchs candidats
  // (et des joueurs alignés en 5v5).
  const tousLesParticipantIds = Array.from(
    new Set(
      candidats
        .filter((m) => m.match_participants.length === 2 && m.tournament)
        .flatMap((m) =>
          m.match_participants.flatMap((p) => [p.profile_id, ...(equipeDe(m, p.profile_id)?.joueurs ?? [])]),
        ),
    ),
  );

  const { data: tousLesComptes } =
    tousLesParticipantIds.length > 0
      ? await supabase
          .from("game_accounts")
          .select("profile_id, puuid, region, verifie_le, game_id")
          .in("profile_id", tousLesParticipantIds)
          // Un seul compte principal par joueur et par jeu (garanti par la base).
          .eq("est_principal", true)
      : { data: [] as CompteRapprochement[] };

  const compteParJoueurEtJeu = new Map(
    (tousLesComptes ?? []).map((c) => [`${c.profile_id}:${c.game_id}`, c]),
  );

  const cache: CacheDetails = new Map();
  let trouves = 0;
  let litiges = 0;
  let ignores = 0;

  for (const m of candidats) {
    if (!m.tournament || !m.demarre_le) {
      ignores += 1;
      continue;
    }
    const statut = m.statut as StatutRecherche;
    const ageMinutes = (Date.now() - new Date(m.demarre_le).getTime()) / 60000;
    const bestOf = m.tournament.best_of;
    const participantIds = m.match_participants.map((p) => p.profile_id);

    if (participantIds.length === 2 && doitChercher(statut, ageMinutes)) {
      const compteA = compteParJoueurEtJeu.get(`${participantIds[0]}:${m.tournament.game_id}`);
      const compteB = compteParJoueurEtJeu.get(`${participantIds[1]}:${m.tournament.game_id}`);
      const region = compteA ? trouverRegion(compteA.region) : undefined;

      if (compteA?.verifie_le && compteB?.verifie_le && compteA.region === compteB.region && region) {
        // 5v5 : puuid des joueurs alignés (compte vérifié, même région).
        const joueursAlignes = (capitaineId: string) =>
          new Map(
            (equipeDe(m, capitaineId)?.joueurs ?? []).flatMap((id) => {
              const compte = compteParJoueurEtJeu.get(`${id}:${m.tournament!.game_id}`);
              return compte?.verifie_le && compte.region === compteA.region ? [[compte.puuid, id] as const] : [];
            }),
          );
        const equipesDuMatch =
          m.tournament.format === "5v5"
            ? { a: joueursAlignes(participantIds[0]), b: joueursAlignes(participantIds[1]) }
            : undefined;
        try {
          const serie = await trouverSerieCorrespondante(
            compteA.puuid,
            compteB.puuid,
            region.continent,
            new Date(m.demarre_le),
            bestOf,
            m.tournament.format === "1v1",
            cache,
            m.tournament.condition_victoire === "classique" ? "classique" : "nexus",
            equipesDuMatch ? { a: [...equipesDuMatch.a.keys()], b: [...equipesDuMatch.b.keys()] } : undefined,
          );
          if (serie && (await enregistrerSerie(admin, m, serie, compteA, compteB, equipesDuMatch))) {
            trouves += 1;
            continue;
          }
        } catch {
          // Erreur API Riot (quota, réseau, clé expirée...) : jamais de
          // résultat inventé, on retentera au prochain passage.
        }
      }
    }

    // Défaite reconnue : tranchée si Riot n'a toujours rien après le délai
    // d'attente. Tant qu'elle attend, le match ne passe pas en litige.
    if (m.defaite_reconnue_par && m.defaite_reconnue_le) {
      const minutesDepuisDefaite = (Date.now() - new Date(m.defaite_reconnue_le).getTime()) / 60000;
      if (defaiteReconnueATrancher(minutesDepuisDefaite) && (await trancherDefaiteReconnue(admin, m))) {
        trouves += 1;
      } else {
        ignores += 1;
      }
      continue;
    }

    // Forfait automatique (audit N4) : un joueur prêt depuis 15 minutes,
    // son adversaire jamais — et aucune partie Riot retrouvée ci-dessus.
    // Jamais pour un scrim (audit N22) : c'est un entraînement.
    if (statut === "en_cours" && m.tournament.nature !== "scrim") {
      const forfait = forfaitAAppliquer(
        m.match_participants.map((p) => ({ profileId: p.profile_id, pretLe: p.pret_le })),
        new Date(),
      );
      if (forfait && (await appliquerForfait(admin, m, forfait, compteParJoueurEtJeu, nomDans(m)))) {
        trouves += 1;
        continue;
      }
    }

    if (statut === "en_cours" && doitPasserEnLitige(ageMinutes, bestOf)) {
      await passerEnLitige(admin, m, nomDans(m));
      litiges += 1;
    } else {
      ignores += 1;
    }
  }

  await annulerDuelsSansResultat(admin);

  return { trouves, litiges, ignores };
}

// Duels (défis entre joueurs, audit N16) et scrims (N22) sans résultat 24 h
// après leur ouverture, recherche Riot terminée : annulés, sans verdict ni
// point — personne n'a à trancher un match que personne n'a joué.
async function annulerDuelsSansResultat(admin: ClientAdmin): Promise<void> {
  const limite = new Date(Date.now() - (RECHERCHE_APRES_LITIGE_HEURES + 1) * 3_600_000).toISOString();
  const { data: duels } = await admin
    .from("matches")
    .select("id, tournament_id, tournament:tournaments!inner(nature, statut), match_verdicts(est_definitif)")
    .in("tournament.nature", ["defi", "scrim"])
    .eq("tournament.statut", "en_cours")
    .in("statut", ["en_cours", "litige"])
    .lt("demarre_le", limite);

  for (const duel of duels ?? []) {
    if (duel.match_verdicts.some((v) => v.est_definitif)) continue;
    await admin.from("tournaments").update({ statut: "annule" }).eq("id", duel.tournament_id).eq("statut", "en_cours");
  }
}
