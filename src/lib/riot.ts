// Intégration API Riot — strictement serveur. Ne jamais importer ce
// fichier depuis un composant client : la clé ne doit jamais atteindre
// le navigateur (règle de sécurité non négociable, cf. CLAUDE.md §6).

import { REGIONS as REGIONS_LOL } from "./regions";

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
