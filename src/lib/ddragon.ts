// Noms et icônes du jeu (champions, objets, runes, sorts d'invocateur) lus
// dans Data Dragon, les fichiers publics que Riot met à disposition des
// sites qui affichent des données de League of Legends : ni clé, ni quota.
// Seule exception à « aucun visuel Riot » (CLAUDE.md §7), décidée le
// 05/10/2026 : l'analyse du joueur (/moi/bilan, /lol/bilan). Fichiers gardés
// une journée en cache ; si Data Dragon ne répond pas, le bilan s'affiche
// avec les noms seuls. Serveur uniquement (les fichiers pèsent plusieurs
// centaines de kilo-octets) : le navigateur ne reçoit que les images.

import { obtenirVersionDDragon } from "./riot";

const BASE = "https://ddragon.leagueoflegends.com";
const LANGUE = "fr_FR";
const UNE_JOURNEE = 86_400;

export interface ElementJeu {
  nom: string;
  /** Adresse de l'icône chez Data Dragon ; nulle si le fichier est inconnu. */
  image: string | null;
  /** Objet, rune ou sort introuvable (Data Dragon injoignable, ou retiré du jeu). */
  inconnu?: boolean;
}

export interface DonneesJeu {
  version: string;
  /** Par numéro de champion (champion_id des parties). */
  champions: Record<string, ElementJeu>;
  /** Par nom interne en minuscules (parties enregistrées avant le 05/10/2026). */
  championsParNom: Record<string, ElementJeu>;
  objets: Record<string, ElementJeu & { build: boolean }>;
  /** Runes et styles de runes, par numéro. */
  runes: Record<string, ElementJeu>;
  /** Sorts d'invocateur, par numéro (Flash = 4). */
  sorts: Record<string, ElementJeu>;
}

// Sous-ensembles des fichiers Data Dragon, seulement ce qui est lu.
interface ImageDDragon {
  full?: string;
}
export interface FichierChampions {
  data: Record<string, { id: string; key: string; name: string; image?: ImageDDragon }>;
}
export interface FichierObjets {
  data: Record<
    string,
    { name: string; image?: ImageDDragon; tags?: string[]; consumed?: boolean; gold?: { total?: number } }
  >;
}
export type FichierRunes = {
  id: number;
  name: string;
  icon: string;
  slots: { runes: { id: number; name: string; icon: string }[] }[];
}[];
export interface FichierSorts {
  data: Record<string, { key: string; name: string; image?: ImageDDragon }>;
}

/**
 * Potions, élixirs, biscuits et balises de contrôle : achetés et consommés
 * en cours de partie, ils ne disent rien d'un build. Écartés même quand
 * Data Dragon ne répond pas.
 */
export const OBJETS_CONSOMMABLES = new Set([2003, 2010, 2031, 2033, 2055, 2138, 2139, 2140]);

// Les noms de fichiers viennent de Data Dragon : on n'en accepte que la
// forme attendue, pour qu'une adresse d'image reste toujours chez Riot.
const FICHIER = /^[\w.-]+\.png$/;
const CHEMIN_RUNE = /^[\w-]+(?:\/[\w.-]+)*\.png$/;

function image(dossier: string, version: string, fichier: string | undefined): string | null {
  return fichier && FICHIER.test(fichier) ? `${BASE}/cdn/${version}/img/${dossier}/${fichier}` : null;
}

function imageRune(chemin: string): string | null {
  return CHEMIN_RUNE.test(chemin) && !chemin.includes("..") ? `${BASE}/cdn/img/${chemin}` : null;
}

/** Données du jeu à partir des fichiers Data Dragon (logique pure, testée). */
export function construireDonneesJeu(
  version: string,
  champions: FichierChampions,
  objets: FichierObjets,
  runes: FichierRunes,
  sorts: FichierSorts,
): DonneesJeu {
  const resultat: DonneesJeu = { version, champions: {}, championsParNom: {}, objets: {}, runes: {}, sorts: {} };
  for (const c of Object.values(champions.data)) {
    const element = { nom: c.name, image: image("champion", version, c.image?.full) };
    resultat.champions[c.key] = element;
    resultat.championsParNom[c.id.toLowerCase()] = element;
  }
  for (const [id, o] of Object.entries(objets.data)) {
    const tags = o.tags ?? [];
    resultat.objets[id] = {
      nom: o.name,
      image: image("item", version, o.image?.full),
      build:
        !OBJETS_CONSOMMABLES.has(Number(id)) &&
        !o.consumed &&
        !tags.includes("Consumable") &&
        !tags.includes("Trinket") &&
        (o.gold?.total ?? 0) > 0,
    };
  }
  for (const style of runes) {
    resultat.runes[String(style.id)] = { nom: style.name, image: imageRune(style.icon) };
    for (const ligne of style.slots) {
      for (const r of ligne.runes) resultat.runes[String(r.id)] = { nom: r.name, image: imageRune(r.icon) };
    }
  }
  for (const s of Object.values(sorts.data)) {
    resultat.sorts[s.key] = { nom: s.name, image: image("spell", version, s.image?.full) };
  }
  return resultat;
}

/** Champion d'une partie : par son numéro, sinon par son nom interne. */
export function championDe(
  donnees: DonneesJeu | null,
  champion: string,
  championId: number | null,
): ElementJeu {
  const trouve =
    (championId !== null ? donnees?.champions[String(championId)] : undefined) ??
    donnees?.championsParNom[champion.toLowerCase()];
  return trouve ?? { nom: champion, image: null };
}

/** Objet, rune ou sort : son nom et son icône, ou un libellé neutre s'il est inconnu. */
export function objetDe(donnees: DonneesJeu | null, id: string | number): ElementJeu {
  return donnees?.objets[String(id)] ?? { nom: `Objet n° ${id}`, image: null, inconnu: true };
}

export function runeDe(donnees: DonneesJeu | null, id: string | number): ElementJeu {
  return donnees?.runes[String(id)] ?? { nom: `Rune n° ${id}`, image: null, inconnu: true };
}

export function sortDe(donnees: DonneesJeu | null, id: string | number): ElementJeu {
  return donnees?.sorts[String(id)] ?? { nom: `Sort n° ${id}`, image: null, inconnu: true };
}

/** Vrai pour un objet qui fait partie d'un build (ni consommable, ni balise). */
export function estObjetDeBuild(donnees: DonneesJeu | null, id: number): boolean {
  if (OBJETS_CONSOMMABLES.has(id)) return false;
  return donnees?.objets[String(id)]?.build ?? true;
}

async function lireJson<T>(url: string): Promise<T> {
  const reponse = await fetch(url, { next: { revalidate: UNE_JOURNEE } });
  if (!reponse.ok) throw new Error(`Data Dragon : ${reponse.status} sur ${url}`);
  return (await reponse.json()) as T;
}

/** Données du jeu de la dernière version publiée ; nulles si Data Dragon ne répond pas. */
export async function chargerDonneesJeu(): Promise<DonneesJeu | null> {
  try {
    const version = await obtenirVersionDDragon();
    if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
    const dossier = `${BASE}/cdn/${version}/data/${LANGUE}`;
    const [champions, objets, runes, sorts] = await Promise.all([
      lireJson<FichierChampions>(`${dossier}/champion.json`),
      lireJson<FichierObjets>(`${dossier}/item.json`),
      lireJson<FichierRunes>(`${dossier}/runesReforged.json`),
      lireJson<FichierSorts>(`${dossier}/summoner.json`),
    ]);
    return construireDonneesJeu(version, champions, objets, runes, sorts);
  } catch (erreur) {
    console.error("Données du jeu indisponibles (Data Dragon)", erreur);
    return null;
  }
}
