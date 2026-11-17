import type { ChronologieRiot } from "@/lib/conditions-1v1";
import type { DetailsMatchRiot, EntreeLigueRiot } from "@/lib/riot";
import { detailsPartie } from "@/lib/capture-partie";

// Bilan du joueur, étape 2 (05/10/2026) : parties classées lues chez Riot
// avec l'accord du joueur, pour l'analyse seulement — jamais pour le
// classement Najarena. Ce fichier dit quoi garder d'une partie et quand
// relire un joueur ; les appels sont dans analyse-classees-serveur.ts.
// Logique pure, testée dans analyse-classees.test.ts.

/** Files classées lues : Solo/Duo et Flexible. */
export const FILES_CLASSEES: Record<number, string> = { 420: "Solo/Duo", 440: "Flexible" };

/** Parties lues à la première lecture, sur les 90 derniers jours au plus. */
export const PREMIERE_LECTURE_PARTIES = 30;
export const PREMIERE_LECTURE_JOURS = 90;
/** Nouvelles parties lues à chaque passage suivant. */
export const LECTURE_SUIVANTE_PARTIES = 20;
/** Un joueur est relu au plus toutes les 6 heures, son rang une fois par jour. */
export const INTERVALLE_SYNCHRO_HEURES = 6;
export const INTERVALLE_RANG_HEURES = 24;
/** Appels Riot par passage de la tâche, par défaut (clé de développement). */
export const APPELS_PAR_PASSAGE = 20;

export const PALIERS_RIOT = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;
export type PalierRiot = (typeof PALIERS_RIOT)[number];

/** Rang Riot en français — à ne pas confondre avec les paliers Najarena (lib/paliers.ts). */
export const LIBELLE_PALIER_RIOT: Record<PalierRiot, string> = {
  IRON: "Fer",
  BRONZE: "Bronze",
  SILVER: "Argent",
  GOLD: "Or",
  PLATINUM: "Platine",
  EMERALD: "Émeraude",
  DIAMOND: "Diamant",
  MASTER: "Maître",
  GRANDMASTER: "Grand maître",
  CHALLENGER: "Challenger",
};

const DIVISIONS = new Set(["I", "II", "III", "IV"]);
const PALIERS_SANS_DIVISION = new Set<PalierRiot>(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export function estPalierRiot(valeur: string | null | undefined): valeur is PalierRiot {
  return (PALIERS_RIOT as readonly string[]).includes(valeur ?? "");
}

export interface RangRiot {
  palier: PalierRiot;
  division: string | null;
  points: number;
  file: "solo" | "flex";
}

/** Rang du joueur : celui de la Solo/Duo s'il existe, sinon celui de la Flexible. */
export function rangDepuisEntrees(entrees: EntreeLigueRiot[]): RangRiot | null {
  const lire = (queueType: string, file: RangRiot["file"]): RangRiot | null => {
    const e = entrees.find((x) => x.queueType === queueType);
    if (!e || !estPalierRiot(e.tier)) return null;
    return {
      palier: e.tier,
      division: PALIERS_SANS_DIVISION.has(e.tier) || !DIVISIONS.has(e.rank) ? null : e.rank,
      points: Math.max(0, Math.round(e.leaguePoints)),
      file,
    };
  };
  return lire("RANKED_SOLO_5x5", "solo") ?? lire("RANKED_FLEX_SR", "flex");
}

/** « Or II · 45 PL », « Maître · 120 PL ». */
export function libelleRang(palier: string | null, division: string | null, points: number | null): string | null {
  if (!estPalierRiot(palier)) return null;
  const nom = `${LIBELLE_PALIER_RIOT[palier]}${division ? ` ${division}` : ""}`;
  return points === null ? nom : `${nom} · ${points} PL`;
}

/** Colonnes d'une partie classée lue (table parties_classees). */
export interface ColonnesPartieClassee {
  file: number;
  joue_le: string;
  duree_secondes: number;
  patch: string | null;
  palier: PalierRiot | null;
  gagne: boolean;
  equipe: number | null;
  champion: string;
  champion_id: number | null;
  poste: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  or_gagne: number;
  degats_champions: number | null;
  score_vision: number | null;
  part_kills: number | null;
  part_degats: number | null;
  sbires_10: number | null;
  premier_sang: boolean | null;
  objets: number[];
  rune_principale: number | null;
  style_secondaire: number | null;
  sorts: number[];
}

export type FichePartieClassee = { ignoree: false; colonnes: ColonnesPartieClassee } | { ignoree: true; raison: string };

const DUREE_MINIMALE_SECONDES = 300;

/**
 * Ce qu'on garde d'une partie classée, pour le joueur `puuid`. Ignorée :
 * file non classée, partie arrêtée par un abandon anticipé, joueur absent.
 */
export function fichePartieClassee(
  details: DetailsMatchRiot,
  puuid: string,
  palier: PalierRiot | null,
): FichePartieClassee {
  const info = details.info;
  if (!(info.queueId in FILES_CLASSEES)) return { ignoree: true, raison: "file non classée" };
  const p = info.participants.find((x) => x.puuid === puuid);
  if (!p) return { ignoree: true, raison: "joueur absent de la partie" };
  if (p.gameEndedInEarlySurrender || info.gameDuration < DUREE_MINIMALE_SECONDES) {
    return { ignoree: true, raison: "partie arrêtée avant 5 minutes" };
  }
  const d = detailsPartie(p, { versionJeu: info.gameVersion, debut: info.gameStartTimestamp });
  return {
    ignoree: false,
    colonnes: {
      file: info.queueId,
      joue_le: new Date(info.gameStartTimestamp).toISOString(),
      duree_secondes: info.gameDuration,
      patch: d.patch,
      palier,
      gagne: p.win,
      equipe: p.teamId === 100 || p.teamId === 200 ? p.teamId : null,
      champion: p.championName,
      champion_id: d.champion_id,
      poste: d.poste,
      kills: Math.max(0, p.kills),
      deaths: Math.max(0, p.deaths),
      assists: Math.max(0, p.assists),
      cs: Math.max(0, p.totalMinionsKilled + p.neutralMinionsKilled),
      or_gagne: Math.max(0, p.goldEarned),
      degats_champions: d.degats_champions,
      score_vision: d.score_vision,
      part_kills: d.part_kills,
      part_degats: d.part_degats,
      sbires_10: d.sbires_10,
      premier_sang: d.premier_sang,
      objets: d.objets,
      rune_principale: d.rune_principale,
      style_secondaire: d.style_secondaire,
      sorts: d.sorts,
    },
  };
}

/** Colonnes tirées de la chronologie d'une partie classée. */
export interface ColonnesChronologie {
  ecart_or_15: number | null;
  morts_avant_10: number;
  morts_secondes: number[];
  morts_x: number[];
  morts_y: number[];
}

const QUINZE_MINUTES_MS = 15 * 60_000;
const DIX_MINUTES_MS = 10 * 60_000;

/**
 * Écart d'or avec le vis-à-vis à 15 minutes (le joueur adverse au même
 * poste, s'il est connu), morts avant 10 minutes, et chaque mort : seconde
 * et lieu sur la carte.
 */
export function chronologiePartieClassee(
  chronologie: ChronologieRiot,
  details: DetailsMatchRiot,
  puuid: string,
): ColonnesChronologie | null {
  const participants = details.info.participants;
  const idDe = (cible: string): number | null => {
    const parChronologie = chronologie.info.participants?.find((x) => x.puuid === cible)?.participantId;
    if (parChronologie) return parChronologie;
    const index = participants.findIndex((x) => x.puuid === cible);
    return index >= 0 ? index + 1 : null;
  };
  const joueur = participants.find((x) => x.puuid === puuid);
  const id = idDe(puuid);
  if (!joueur || id === null) return null;

  const poste = joueur.teamPosition;
  const visAVis = poste ? participants.find((x) => x.teamId !== joueur.teamId && x.teamPosition === poste) : undefined;
  const idVisAVis = visAVis ? idDe(visAVis.puuid) : null;
  const image15 = chronologie.info.frames.find((f) => f.timestamp >= QUINZE_MINUTES_MS - 1_000);
  const orJoueur = image15?.participantFrames?.[String(id)]?.totalGold;
  const orVisAVis = idVisAVis === null ? undefined : image15?.participantFrames?.[String(idVisAVis)]?.totalGold;
  const ecart = typeof orJoueur === "number" && typeof orVisAVis === "number" ? Math.round(orJoueur - orVisAVis) : null;

  const morts = chronologie.info.frames
    .flatMap((f) => f.events ?? [])
    .filter((e) => e.type === "CHAMPION_KILL" && e.victimId === id)
    .sort((a, b) => a.timestamp - b.timestamp);
  const placees = morts.filter(
    (e) => e.position && Number.isFinite(e.position.x) && Number.isFinite(e.position.y),
  );
  return {
    ecart_or_15: ecart,
    morts_avant_10: morts.filter((e) => e.timestamp < DIX_MINUTES_MS).length,
    morts_secondes: placees.map((e) => Math.round(e.timestamp / 1000)),
    morts_x: placees.map((e) => Math.round(e.position?.x ?? 0)),
    morts_y: placees.map((e) => Math.round(e.position?.y ?? 0)),
  };
}

export interface ReglageSynchro {
  profile_id: string;
  derniere_synchro: string | null;
  rang_lu_le: string | null;
}

/** Joueurs à relire, les plus anciens d'abord (jamais lus en premier). */
export function joueursARelire<T extends ReglageSynchro>(reglages: T[], maintenant: Date, nombre: number): T[] {
  const limite = maintenant.getTime() - INTERVALLE_SYNCHRO_HEURES * 3_600_000;
  return reglages
    .filter((r) => r.derniere_synchro === null || new Date(r.derniere_synchro).getTime() <= limite)
    .sort((a, b) => (a.derniere_synchro ?? "").localeCompare(b.derniere_synchro ?? ""))
    .slice(0, nombre);
}

export function rangARelire(rangLuLe: string | null, maintenant: Date): boolean {
  return rangLuLe === null || new Date(rangLuLe).getTime() <= maintenant.getTime() - INTERVALLE_RANG_HEURES * 3_600_000;
}

/**
 * Depuis quand et combien de parties demander : 90 jours et 30 parties à
 * la première lecture, sinon depuis la partie la plus récente déjà gardée.
 */
export function fenetreLecture(
  derniereJouee: string | null,
  maintenant: Date,
): { depuisSecondes: number; nombre: number } {
  const plancher = Math.floor(maintenant.getTime() / 1000) - PREMIERE_LECTURE_JOURS * 86_400;
  if (derniereJouee === null) return { depuisSecondes: plancher, nombre: PREMIERE_LECTURE_PARTIES };
  return {
    depuisSecondes: Math.max(plancher, Math.floor(new Date(derniereJouee).getTime() / 1000) + 1),
    nombre: LECTURE_SUIVANTE_PARTIES,
  };
}

/** Appels Riot par passage : ANALYSE_APPELS_PAR_PASSAGE, entre 0 et 500. */
export function budgetAppels(valeur: string | undefined): number {
  const n = Number(valeur);
  return valeur !== undefined && valeur.trim() !== "" && Number.isFinite(n)
    ? Math.min(500, Math.max(0, Math.floor(n)))
    : APPELS_PAR_PASSAGE;
}
