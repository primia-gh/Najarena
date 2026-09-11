// Rapprochement par historique — verdict de niveau 2 (docs/moteur-
// resultats.md §3). Retrouve, dans l'historique Riot des deux joueurs
// d'un match, la partie officielle qui correspond, et journalise le
// résultat. Ne consomme jamais l'API Riot depuis le navigateur (§6.2) —
// ce fichier n'est appelé que depuis du code serveur.

import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { trouverRegion, recupererIdsMatchsRecents, recupererDetailsMatch, type Continent } from "@/lib/riot";
import { notifierJoueur, URL_SITE } from "@/lib/notifications";

// Cadence de recherche : pas avant T+8 (l'historique Riot n'est pas
// immédiat), litige si rien trouvé à T+25.
const PREMIERE_RECHERCHE_MINUTES = 8;
const LIMITE_LITIGE_MINUTES = 25;

// Seuil de remake : une partie plus courte que ça n'est pas un vrai
// résultat (abandon précoce, remake voté). Valeur communément admise
// dans l'écosystème LoL — à ajuster si Riot publie un seuil officiel.
const DUREE_MIN_SECONDES = 300;

// queueId 0 = partie personnalisée. Il n'existe pas de file matchmakée
// "1v1" officielle côté Riot : un tournoi communautaire 1v1 se joue
// forcément en lobby personnalisé, donc ce n'est pas un choix produit
// arbitraire mais une contrainte structurelle de l'API.
const QUEUE_ID_PERSONNALISEE = 0;

interface PartieTrouvee {
  riotMatchId: string;
  gagnantPuuid: string;
}

/**
 * Applique les 4 critères de docs/moteur-resultats.md §3 sur l'historique
 * du joueur A pour retrouver la partie jouée contre le joueur B. Si
 * plusieurs parties correspondent, retient la plus ancienne postérieure à
 * l'ouverture du match (comme spécifié).
 */
export async function trouverPartieCorrespondante(
  puuidA: string,
  puuidB: string,
  continent: Continent,
  ouvertureLe: Date,
): Promise<PartieTrouvee | null> {
  const idsRecents = await recupererIdsMatchsRecents(
    puuidA,
    continent,
    Math.floor(ouvertureLe.getTime() / 1000),
  );

  let meilleure: (PartieTrouvee & { debut: number }) | null = null;

  for (const matchId of idsRecents) {
    const details = await recupererDetailsMatch(matchId, continent);
    const { info } = details;

    const participantA = info.participants.find((p) => p.puuid === puuidA);
    const participantB = info.participants.find((p) => p.puuid === puuidB);
    if (!participantA || !participantB) continue; // critère 1 : les deux puuid y figurent

    if (info.gameStartTimestamp < ouvertureLe.getTime()) continue; // critère 2 : postérieure à l'ouverture
    if (info.queueId !== QUEUE_ID_PERSONNALISEE) continue; // critère 3 : mode annoncé
    if (info.gameDuration < DUREE_MIN_SECONDES) continue; // critère 4 : au-delà du seuil de remake

    if (!meilleure || info.gameStartTimestamp < meilleure.debut) {
      meilleure = {
        riotMatchId: matchId,
        gagnantPuuid: participantA.win ? puuidA : puuidB,
        debut: info.gameStartTimestamp,
      };
    }
  }

  return meilleure ? { riotMatchId: meilleure.riotMatchId, gagnantPuuid: meilleure.gagnantPuuid } : null;
}

interface CompteRapprochement {
  profile_id: string;
  puuid: string;
  region: string;
  verifie_le: string | null;
}

/**
 * Worker de recherche de résultats (docs/moteur-resultats.md §6, "1 min").
 * Parcourt les matchs en_cours démarrés depuis au moins 8 minutes ; pour
 * chacun, tente le rapprochement niveau 2. Passé 25 minutes sans partie
 * trouvée, le match passe en litige — jamais de résultat inventé.
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

  const seuilRecherche = new Date(
    Date.now() - PREMIERE_RECHERCHE_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: candidats } = await supabase
    .from("matches")
    .select(
      "id, demarre_le, tournament:tournaments(game_id, nom, slug), match_participants(profile_id)",
    )
    .eq("statut", "en_cours")
    .lte("demarre_le", seuilRecherche);

  let trouves = 0;
  let litiges = 0;
  let ignores = 0;

  for (const m of candidats ?? []) {
    const demarreLe = new Date(m.demarre_le!);
    const ageMinutes = (Date.now() - demarreLe.getTime()) / 60000;
    const participantIds = m.match_participants.map((p) => p.profile_id);

    let partieTrouvee: PartieTrouvee | null = null;
    let compteA: CompteRapprochement | undefined;
    let compteB: CompteRapprochement | undefined;

    if (participantIds.length === 2 && m.tournament) {
      const { data: comptes } = await supabase
        .from("game_accounts")
        .select("profile_id, puuid, region, verifie_le")
        .in("profile_id", participantIds)
        .eq("game_id", m.tournament.game_id);

      compteA = comptes?.find((c) => c.profile_id === participantIds[0]);
      compteB = comptes?.find((c) => c.profile_id === participantIds[1]);

      if (compteA?.verifie_le && compteB?.verifie_le && compteA.region === compteB.region) {
        const region = trouverRegion(compteA.region);
        if (region) {
          try {
            partieTrouvee = await trouverPartieCorrespondante(
              compteA.puuid,
              compteB.puuid,
              region.continent,
              demarreLe,
            );
          } catch {
            // Erreur API Riot (quota, réseau, clé expirée...) — on
            // n'invente jamais de résultat, on retentera au prochain
            // passage du worker.
          }
        }
      }
    }

    if (partieTrouvee && compteA && compteB) {
      const gagnantId =
        partieTrouvee.gagnantPuuid === compteA.puuid ? compteA.profile_id : compteB.profile_id;

      const { data: ecrit } = await admin.rpc("enregistrer_verdict_historique", {
        p_match_id: m.id,
        p_gagnant_id: gagnantId,
        p_riot_match_id: partieTrouvee.riotMatchId,
      });

      if (ecrit) {
        trouves += 1;
        if (m.tournament) {
          for (const profileId of participantIds) {
            const aGagne = profileId === gagnantId;
            await notifierJoueur(
              profileId,
              `Résultat trouvé — ${m.tournament.nom}`,
              aGagne ? "Victoire confirmée dans l'historique Riot" : "Résultat confirmé dans l'historique Riot",
              `<p>La partie officielle a été retrouvée automatiquement dans l'historique Riot.</p>
               <p><a href="${URL_SITE}/lol/tournois/${m.tournament.slug}">Voir le bracket</a></p>`,
            );
          }
        }
        continue;
      }
    }

    if (ageMinutes >= LIMITE_LITIGE_MINUTES) {
      await admin.from("matches").update({ statut: "litige" }).eq("id", m.id);
      litiges += 1;
    } else {
      ignores += 1;
    }
  }

  return { trouves, litiges, ignores };
}
