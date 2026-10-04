// Logique pure du rapprochement niveau 2 (docs/moteur-resultats.md §3) :
// décider d'une série Best-of à partir des parties retrouvées chez Riot, et
// savoir quand chercher, quand passer en litige, quand trancher une défaite
// reconnue. Aucun accès réseau ni base : testée dans serie.test.ts,
// appliquée par src/lib/rapprochement.ts.

// Pas de recherche avant T+8 min : l'historique Riot n'est pas immédiat.
export const PREMIERE_RECHERCHE_MINUTES = 8;

// Après le passage en litige, la recherche continue une fois toutes les
// 30 minutes environ pendant 24 h : une partie retrouvée tard (clé Riot
// renouvelée, historique lent) résout encore le litige et compte au
// classement. Avant le 28/09/2026, un match en litige n'était plus jamais
// recherché.
export const RECHERCHE_APRES_LITIGE_HEURES = 24;
const INTERVALLE_RECHERCHE_LITIGE_MINUTES = 30;
const CADENCE_TACHE_MINUTES = 5; // pg_cron appelle la recherche toutes les 5 min

// Défaite reconnue par un joueur : on laisse encore ce délai à l'historique
// Riot pour confirmer (verdict niveau 2, qui compte) avant de trancher sur
// la seule parole du perdant (niveau 1, hors classement).
export const ATTENTE_APRES_DEFAITE_RECONNUE_MINUTES = 20;

// Seuil de remake : une partie plus courte n'est pas un vrai résultat.
export const DUREE_MIN_SECONDES = 300;

// queueId 0 = partie personnalisée : il n'existe pas de file Riot « 1v1 ».
export const QUEUE_ID_PERSONNALISEE = 0;

/** Victoires nécessaires pour remporter un Best-of (Bo1 : 1, Bo3 : 2, Bo5 : 3). */
export function victoiresNecessaires(bestOf: number): number {
  return Math.floor(Math.max(1, bestOf) / 2) + 1;
}

/**
 * Délai après l'ouverture du match au-delà duquel, sans résultat, il passe
 * en litige. Il faut créer la partie personnalisée, la jouer jusqu'au Nexus
 * puis attendre que Riot publie l'historique, pour chaque manche : 60 min
 * en Bo1, 120 en Bo3, 180 en Bo5 (25 min en Bo1 jusqu'au 28/09/2026, trop
 * court pour une vraie partie).
 */
export function delaiAvantLitigeMinutes(bestOf: number): number {
  return 30 + 30 * Math.max(1, bestOf);
}

export type StatutRecherche = "en_cours" | "litige";

/** Faut-il interroger Riot pour ce match à ce passage de la tâche ? */
export function doitChercher(statut: StatutRecherche, ageMinutes: number): boolean {
  if (ageMinutes < PREMIERE_RECHERCHE_MINUTES) return false;
  if (statut === "en_cours") return true;
  if (ageMinutes > RECHERCHE_APRES_LITIGE_HEURES * 60) return false;
  // Environ un passage sur six (la tâche tourne toutes les 5 min) : le
  // quota de l'API Riot reste réservé aux matchs en cours.
  const passages = INTERVALLE_RECHERCHE_LITIGE_MINUTES / CADENCE_TACHE_MINUTES;
  return Math.floor(ageMinutes / CADENCE_TACHE_MINUTES) % passages === 0;
}

export function doitPasserEnLitige(ageMinutes: number, bestOf: number): boolean {
  return ageMinutes >= delaiAvantLitigeMinutes(bestOf);
}

export function defaiteReconnueATrancher(minutesDepuisDefaite: number): boolean {
  return minutesDepuisDefaite >= ATTENTE_APRES_DEFAITE_RECONNUE_MINUTES;
}

export interface PartieSerie {
  riotMatchId: string;
  /** Début de la partie, en millisecondes depuis 1970 (Riot : gameStartTimestamp). */
  debut: number;
  gagnantEstA: boolean;
}

export interface ResultatSerie<P extends PartieSerie = PartieSerie> {
  gagnantEstA: boolean;
  /** Les parties qui ont décidé la série, dans l'ordre ; la dernière est la manche décisive. */
  parties: P[];
}

/**
 * Rejoue les parties dans l'ordre chronologique et s'arrête dès qu'un joueur
 * atteint le nombre de victoires nécessaire. Null tant que la série n'est
 * pas finie : on n'invente jamais un résultat (une série à 1-1 reste en
 * attente). Les parties jouées après la manche décisive sont ignorées.
 */
export function deciderSerie<P extends PartieSerie>(parties: P[], bestOf: number): ResultatSerie<P> | null {
  const requises = victoiresNecessaires(bestOf);
  const triees = [...parties].sort((a, b) => a.debut - b.debut);
  let victoiresA = 0;
  let victoiresB = 0;
  const retenues: P[] = [];
  for (const partie of triees) {
    retenues.push(partie);
    if (partie.gagnantEstA) victoiresA += 1;
    else victoiresB += 1;
    if (victoiresA >= requises || victoiresB >= requises) {
      return { gagnantEstA: victoiresA >= requises, parties: retenues };
    }
  }
  return null;
}
