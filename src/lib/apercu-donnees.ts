import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Données des visuels « en un coup d'œil » du profil et du classement
// (étape 3 du plan « site plus visuel », validée par le porteur le
// 27/11/2026). Toujours de vraies données : quand elles manquent, le visuel
// affiche son état vide. Fonctions pures testées dans apercu-donnees.test.ts.

/** En dessous, la répartition n'est pas montrée (trois points ne font pas une répartition). */
export const SEUIL_REPARTITION = 10;
export const PAS_REPARTITION = 50;
/** Lecture de tous les ratings classés de la saison, plafonnée (Supabase rend 1000 lignes au plus). */
const PLAFOND_LECTURE = 1000;

export interface Repartition {
  /** Début de la première classe de rating. */
  debut: number;
  pas: number;
  /** Nombre de joueurs dans chaque classe [debut + i*pas, debut + (i+1)*pas[. */
  classes: number[];
  total: number;
}

/** Classes de 50 points couvrant au moins 1150 à 2150 (zones des paliers). */
export function construireRepartition(ratings: number[], pas = PAS_REPARTITION): Repartition | null {
  if (ratings.length < SEUIL_REPARTITION) return null;
  const min = Math.min(1150, Math.floor(Math.min(...ratings) / pas) * pas);
  const max = Math.max(2150, (Math.floor(Math.max(...ratings) / pas) + 1) * pas);
  const classes = Array.from({ length: Math.round((max - min) / pas) }, () => 0);
  for (const r of ratings) classes[Math.min(classes.length - 1, Math.floor((r - min) / pas))] += 1;
  return { debut: min, pas, classes, total: ratings.length };
}

/**
 * Ratings de tous les joueurs classés de la saison. Null si la lecture est
 * incomplète (plus de joueurs que le plafond, ou que le compte attendu) :
 * une répartition partielle serait fausse, on ne la montre pas.
 * À remplacer par une fonction de comptage en base au-delà de quelques
 * milliers de joueurs classés.
 */
export async function chargerRatingsClasses(
  supabase: SupabaseClient<Database>,
  saisonId: string,
  totalAttendu: number,
): Promise<number[] | null> {
  if (totalAttendu < SEUIL_REPARTITION || totalAttendu > PLAFOND_LECTURE) return null;
  const { data, error } = await supabase
    .from("ratings")
    .select("rating")
    .eq("game_id", 1)
    .eq("season_id", saisonId)
    .eq("est_classe", true)
    .limit(PLAFOND_LECTURE);
  if (error || !data || data.length !== totalAttendu) return null;
  return data.map((r) => Number(r.rating));
}

export const SEMAINES_ACTIVITE = 12;
const SEMAINE_MS = 7 * 24 * 3600 * 1000;

/** Matchs par semaine glissante, de la plus ancienne (index 0) à la semaine en cours (index 11). */
export function semainesActivite(dates: string[], maintenantMs: number): number[] {
  const semaines = Array.from({ length: SEMAINES_ACTIVITE }, () => 0);
  for (const d of dates) {
    const ecart = Math.floor((maintenantMs - new Date(d).getTime()) / SEMAINE_MS);
    if (ecart >= 0 && ecart < SEMAINES_ACTIVITE) semaines[SEMAINES_ACTIVITE - 1 - ecart] += 1;
  }
  return semaines;
}

export type ResultatForme = "V" | "D" | "M";

export interface MatchApercu {
  niveau: string;
  estGagnant: boolean | null;
  creeLe: string;
  /** Lu chez Riot, mais compte Riot sous le niveau requis : sans points (chiffresCV). */
  horsClassementNiveau: boolean;
}

/** Match vérifié au sens des chiffres clés du profil : lu chez Riot ET compté. */
export const estVerifie = (h: MatchApercu) => h.niveau !== "manuel" && !h.horsClassementNiveau;

/**
 * Mêmes catégories que chiffresCV : vérifiés, décisions manuelles, et à part
 * les matchs « sans points ». Forme : 10 derniers matchs comptés (le plus
 * récent en dernier) ; un résultat inconnu n'est jamais présenté en défaite.
 */
export function bilanPreuve(historique: MatchApercu[]): {
  verifies: number;
  manuels: number;
  sansPoints: number;
  forme: ResultatForme[];
} {
  const comptes = historique.filter((h) => !h.horsClassementNiveau);
  const verifies = comptes.filter((h) => h.niveau !== "manuel").length;
  const forme = [...comptes]
    .filter((h) => h.niveau === "manuel" || h.estGagnant !== null)
    .sort((a, b) => new Date(b.creeLe).getTime() - new Date(a.creeLe).getTime())
    .slice(0, 10)
    .reverse()
    .map((h): ResultatForme => (h.niveau === "manuel" ? "M" : h.estGagnant ? "V" : "D"));
  return { verifies, manuels: comptes.length - verifies, sansPoints: historique.length - comptes.length, forme };
}
