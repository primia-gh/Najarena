// Intégration API Riot — strictement serveur. Ne jamais importer ce
// fichier depuis un composant client : la clé ne doit jamais atteindre
// le navigateur (règle de sécurité non négociable, cf. CLAUDE.md §6).

import { REGIONS as REGIONS_LOL } from "./regions";
import type { ChronologieRiot } from "./conditions-1v1";

export type Continent = "europe" | "americas" | "asia";

export interface RegionRiot {
  code: string; // valeur stockée en base et affichée à l'utilisateur
  nom: string;
  plateforme: string; // routage plateforme (summoner-v4) : euw1, na1...
  continent: Continent; // routage continental (account-v1)
}

const ROUTAGE: Record<string, { plateforme: string; continent: Continent }> = {
  EUW: { plateforme: "euw1", continent: "europe" },
  EUNE: { plateforme: "eun1", continent: "europe" },
  TR: { plateforme: "tr1", continent: "europe" },
  RU: { plateforme: "ru", continent: "europe" },
  NA: { plateforme: "na1", continent: "americas" },
  BR: { plateforme: "br1", continent: "americas" },
  LAN: { plateforme: "la1", continent: "americas" },
  LAS: { plateforme: "la2", continent: "americas" },
  OCE: { plateforme: "oc1", continent: "americas" },
  KR: { plateforme: "kr", continent: "asia" },
  JP: { plateforme: "jp1", continent: "asia" },
};

export const REGIONS: RegionRiot[] = REGIONS_LOL.map((r) => ({ ...r, ...ROUTAGE[r.code] }));

export function trouverRegion(code: string): RegionRiot | undefined {
  return REGIONS.find((r) => r.code === code);
}

export type CodeErreurRiot = "cle_absente" | "introuvable" | "cle_invalide" | "limite" | "reseau";

export class ErreurRiot extends Error {
  constructor(
    public code: CodeErreurRiot,
    message: string,
  ) {
    super(message);
  }
}

async function appelRiot<T>(url: string): Promise<T> {
  const cle = process.env.RIOT_API_KEY;
  if (!cle) {
    throw new ErreurRiot(
      "cle_absente",
      "La clé API Riot n'est pas configurée côté serveur (RIOT_API_KEY). Elle expire toutes les 24h et doit être renouvelée régulièrement.",
    );
  }

  let reponse: Response;
  try {
    reponse = await fetch(url, { headers: { "X-Riot-Token": cle } });
  } catch {
    throw new ErreurRiot("reseau", "Impossible de contacter les serveurs Riot pour l'instant.");
  }

  if (reponse.status === 404) {
    throw new ErreurRiot("introuvable", "Introuvable.");
  }
  if (reponse.status === 401 || reponse.status === 403) {
    throw new ErreurRiot("cle_invalide", "La clé API Riot est invalide ou a expiré.");
  }
  if (reponse.status === 429) {
    throw new ErreurRiot("limite", "Trop de requêtes vers l'API Riot, réessaie dans une minute.");
  }
  if (!reponse.ok) {
    throw new ErreurRiot("reseau", `Erreur Riot inattendue (${reponse.status}).`);
  }

  return reponse.json() as Promise<T>;
}

export type EtatCleRiot = "valide" | "absente" | "invalide" | "injoignable";

/**
 * Vérifie la clé API Riot par l'appel le plus léger qui l'exige (état de la
 * plateforme EUW). La clé de développement expire toutes les 24 h
 * (CLAUDE.md §2) : sans elle, plus aucun compte ne se lie et aucun résultat
 * n'est lu. Surveillée avant chaque tournoi automatique
 * (src/lib/tournois-auto/execution.ts).
 */
export async function verifierCleRiot(): Promise<EtatCleRiot> {
  try {
    await appelRiot<unknown>("https://euw1.api.riotgames.com/lol/status/v4/platform-data");
    return "valide";
  } catch (e) {
    if (e instanceof ErreurRiot) {
      if (e.code === "cle_absente") return "absente";
      if (e.code === "cle_invalide") return "invalide";
      // Quota atteint : la clé est refusée pour l'instant, mais valide.
      if (e.code === "limite") return "valide";
    }
    return "injoignable";
  }
}

export interface CompteRiot {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export async function resoudreRiotId(
  gameName: string,
  tagLine: string,
  continent: Continent,
): Promise<CompteRiot> {
  const url = `https://${continent}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return appelRiot<CompteRiot>(url);
}

export interface InvocateurRiot {
  profileIconId: number;
  summonerLevel: number;
}

export async function recupererInvocateur(
  puuid: string,
  plateforme: string,
): Promise<InvocateurRiot> {
  const url = `https://${plateforme}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  return appelRiot<InvocateurRiot>(url);
}

export interface ParticipantMatchRiot {
  puuid: string;
  win: boolean;
  /** 100 ou 200 (conditions du 1v1 classique, src/lib/conditions-1v1.ts). */
  teamId?: number;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  // Détails gardés pour le bilan du joueur (05/10/2026), déjà présents
  // dans la réponse : aucun appel de plus. Facultatifs, Riot pouvant en
  // omettre selon le mode de jeu.
  championId?: number;
  champLevel?: number;
  teamPosition?: string;
  individualPosition?: string;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  summoner1Id?: number;
  summoner2Id?: number;
  perks?: {
    statPerks?: { offense?: number; flex?: number; defense?: number };
    styles?: { description?: string; style?: number; selections?: { perk?: number }[] }[];
  };
  totalDamageDealtToChampions?: number;
  totalDamageTaken?: number;
  damageSelfMitigated?: number;
  damageDealtToBuildings?: number;
  totalHeal?: number;
  timeCCingOthers?: number;
  visionScore?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  detectorWardsPlaced?: number;
  turretTakedowns?: number;
  firstBloodKill?: boolean;
  firstTowerKill?: boolean;
  firstTowerAssist?: boolean;
  largestMultiKill?: number;
  totalTimeSpentDead?: number;
  challenges?: {
    soloKills?: number;
    killParticipation?: number;
    teamDamagePercentage?: number;
    laneMinionsFirst10Minutes?: number;
  };
}

export interface DetailsMatchRiot {
  info: {
    gameStartTimestamp: number; // ms epoch
    gameDuration: number; // secondes
    queueId: number; // 0 = partie personnalisée
    /** « 15.19.715.1234 » : le patch de la partie. */
    gameVersion?: string;
    participants: ParticipantMatchRiot[];
  };
}

// match-v5 — historique de matchs (niveau 2, docs/moteur-resultats.md §3).
// Routage continental, comme account-v1. `queue` filtre côté Riot (0 =
// parties personnalisées) : les parties classées ou normales jouées entre-
// temps ne coûtent plus une requête de détail chacune.
export async function recupererIdsMatchsRecents(
  puuid: string,
  continent: Continent,
  depuisSecondes: number,
  queue?: number,
): Promise<string[]> {
  const filtreQueue = queue === undefined ? "" : `&queue=${queue}`;
  const url = `https://${continent}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?startTime=${depuisSecondes}&count=20${filtreQueue}`;
  return appelRiot<string[]>(url);
}

export async function recupererDetailsMatch(
  matchId: string,
  continent: Continent,
): Promise<DetailsMatchRiot> {
  const url = `https://${continent}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return appelRiot<DetailsMatchRiot>(url);
}

// match-v5 timeline — chronologie minute par minute d'une partie (morts,
// tours, sbires). Sert au 1v1 classique (audit N5) : qui a rempli la
// première condition de victoire.
export async function recupererChronologieMatch(matchId: string, continent: Continent): Promise<ChronologieRiot> {
  const url = `https://${continent}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;
  return appelRiot<ChronologieRiot>(url);
}

// spectator-v5 — partie en cours d'un joueur (routage plateforme). Sert de
// garde-fou au forfait automatique (audit N4) : un joueur en partie à cet
// instant n'est jamais déclaré forfait, même s'il a oublié de se dire prêt.
export async function estEnPartie(puuid: string, plateforme: string): Promise<boolean> {
  try {
    await appelRiot<unknown>(
      `https://${plateforme}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`,
    );
    return true;
  } catch (e) {
    if (e instanceof ErreurRiot && e.code === "introuvable") return false;
    throw e;
  }
}

// clash-v1 — tournois Clash à venir d'une région (routage plateforme).
// Alimente le calendrier des échéances (audit N24) : les dates viennent de
// Riot, jamais d'une saisie.
export interface PhaseClashRiot {
  id: number;
  registrationTime: number; // ms epoch
  startTime: number; // ms epoch
  cancelled: boolean;
}

export interface TournoiClashRiot {
  id: number;
  themeId: number;
  nameKey: string;
  nameKeySecondary: string;
  schedule: PhaseClashRiot[];
}

export async function recupererTournoisClash(plateforme: string): Promise<TournoiClashRiot[]> {
  return appelRiot<TournoiClashRiot[]>(`https://${plateforme}.api.riotgames.com/lol/clash/v1/tournaments`);
}

// Data Dragon : CDN statique public, ni clé ni quota — sert uniquement à
// afficher l'image de l'icône-défi, aucune donnée de compte n'y transite.
const VERSION_DDRAGON_PAR_DEFAUT = "14.1.1";

export async function obtenirVersionDDragon(): Promise<string> {
  try {
    const reponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
      next: { revalidate: 3600 },
    });
    const versions = (await reponse.json()) as string[];
    return versions[0] ?? VERSION_DDRAGON_PAR_DEFAUT;
  } catch {
    return VERSION_DDRAGON_PAR_DEFAUT;
  }
}

export function urlIconeProfil(version: string, iconeId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconeId}.png`;
}

// Identifiant Data Dragon du champion (ex. "Kaisa", "Zed") — pas son nom
// affiché en jeu, voir la liste `championFull.json` du CDN.
export function urlIconeChampion(version: string, championId: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`;
}

export function traduireErreurRiot(e: unknown): string {
  if (e instanceof ErreurRiot) {
    switch (e.code) {
      case "cle_absente":
      case "cle_invalide":
        return "Le service de vérification Riot n'est pas disponible pour l'instant (clé serveur manquante ou expirée) — réessaie plus tard.";
      case "introuvable":
        return "Riot ID introuvable dans cette région. Vérifie l'orthographe et le tag (après le #).";
      case "limite":
        return "Trop de requêtes vers Riot, réessaie dans une minute.";
      default:
        return "Impossible de contacter les serveurs Riot pour l'instant.";
    }
  }
  return "Une erreur est survenue. Réessaie.";
}
