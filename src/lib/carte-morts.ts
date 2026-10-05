// Carte des morts (bilan du joueur, étape 2, 05/10/2026) : où et quand le
// joueur meurt en classée, d'après la chronologie Riot de ses parties.
// Toujours vue de son côté (sa base en bas à gauche, comme une partie
// jouée côté bleu) ; zones approximatives, découpées par nos soins sur les
// coordonnées de la Faille de l'invocateur, dessinées sur une carte
// schématique sans aucun visuel Riot (components/bilan/CarteMorts.tsx).
// Logique pure, testée.

/** Étendue des coordonnées de la Faille de l'invocateur (de 0 à environ 14 870 sur chaque axe). */
export const TAILLE_CARTE = 14870;
export const MORTS_MIN_CARTE = 10;

export type ZoneCarte =
  | "base"
  | "base_adverse"
  | "voie_haut"
  | "voie_milieu"
  | "voie_bas"
  | "riviere"
  | "jungle"
  | "jungle_adverse";

export const LIBELLE_ZONE: Record<ZoneCarte, string> = {
  base: "ta base",
  base_adverse: "la base adverse",
  voie_haut: "la voie du haut",
  voie_milieu: "la voie du milieu",
  voie_bas: "la voie du bas",
  riviere: "la rivière",
  jungle: "ta jungle",
  jungle_adverse: "la jungle adverse",
};

export type PhaseMort = "0-10" | "10-20" | "20-30" | "30+";

export const LIBELLE_PHASE: Record<PhaseMort, string> = {
  "0-10": "avant 10 minutes",
  "10-20": "entre 10 et 20 minutes",
  "20-30": "entre 20 et 30 minutes",
  "30+": "après 30 minutes",
};

/** Coordonnées vues du côté du joueur : une partie côté rouge est retournée. */
export function versTonCote(x: number, y: number, equipe: number | null): { x: number; y: number } {
  return equipe === 200 ? { x: TAILLE_CARTE - x, y: TAILLE_CARTE - y } : { x, y };
}

/** Zone d'un point, dans les coordonnées vues du côté du joueur (sa base en bas à gauche). */
export function zoneDe(x: number, y: number): ZoneCarte {
  if (x < 3800 && y < 3800) return "base";
  if (x > 11000 && y > 11000) return "base_adverse";
  if (x < 2300 || y > 12500) return "voie_haut";
  if (y < 2300 || x > 12500) return "voie_bas";
  if (Math.abs(x - y) < 1600) return "voie_milieu";
  if (Math.abs(x + y - TAILLE_CARTE) < 1500) return "riviere";
  return x + y < TAILLE_CARTE ? "jungle" : "jungle_adverse";
}

export function phaseDe(seconde: number): PhaseMort {
  if (seconde < 600) return "0-10";
  if (seconde < 1200) return "10-20";
  if (seconde < 1800) return "20-30";
  return "30+";
}

export interface MortPlacee {
  x: number;
  y: number;
  seconde: number;
  zone: ZoneCarte;
  phase: PhaseMort;
  gagne: boolean;
}

export interface Repartition<T extends string> {
  cle: T;
  nombre: number;
  part: number;
}

export interface CarteMorts {
  morts: MortPlacee[];
  parties: number;
  parZone: Repartition<ZoneCarte>[];
  parPhase: Repartition<PhaseMort>[];
}

export interface PartieAvecMorts {
  equipe: number | null;
  gagne: boolean;
  morts_secondes: number[] | null;
  morts_x: number[] | null;
  morts_y: number[] | null;
}

function repartition<T extends string>(cles: readonly T[], valeurs: T[]): Repartition<T>[] {
  return cles
    .map((cle) => {
      const nombre = valeurs.filter((v) => v === cle).length;
      return { cle, nombre, part: valeurs.length > 0 ? nombre / valeurs.length : 0 };
    })
    .sort((a, b) => b.nombre - a.nombre);
}

/** Morts placées sur la carte ; nulle sous 10 morts (pas assez pour en dire quelque chose). */
export function carteDesMorts(parties: PartieAvecMorts[]): CarteMorts | null {
  const avecMorts = parties.filter((p) => p.morts_secondes !== null);
  const morts = avecMorts.flatMap((p) =>
    (p.morts_secondes ?? []).flatMap((seconde, i) => {
      const xBrut = p.morts_x?.[i];
      const yBrut = p.morts_y?.[i];
      if (typeof xBrut !== "number" || typeof yBrut !== "number") return [];
      const { x, y } = versTonCote(xBrut, yBrut, p.equipe);
      return [{ x, y, seconde, zone: zoneDe(x, y), phase: phaseDe(seconde), gagne: p.gagne }];
    }),
  );
  if (morts.length < MORTS_MIN_CARTE) return null;
  return {
    morts,
    parties: avecMorts.length,
    parZone: repartition(Object.keys(LIBELLE_ZONE) as ZoneCarte[], morts.map((m) => m.zone)),
    parPhase: repartition(Object.keys(LIBELLE_PHASE) as PhaseMort[], morts.map((m) => m.phase)),
  };
}
