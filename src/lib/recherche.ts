// Recherche recruteurs (18/11/2026, roadmap phase 4 « scouting ») : filtres
// de /lol/recherche, lus dans l'adresse, et mise en mots des colonnes. La
// recherche elle-même est faite par la base (rechercher_joueurs,
// docs/schema.sql), sur tous les comptes Riot vérifiés, à partir de données
// vérifiées et déjà publiques sur les CV. Logique pure, testée dans
// recherche.test.ts.

import { REGIONS } from "./regions";
import { ROLES, type Role } from "./roles";
import { MINIMUM_FIABILITE } from "./fiabilite";

export const ACTIVITES_JOURS = [7, 30, 90] as const;
export type ActiviteJours = (typeof ACTIVITES_JOURS)[number];

export const TRIS = ["rating", "progression", "activite"] as const;
export type Tri = (typeof TRIS)[number];

export const LABEL_TRI: Record<Tri, string> = {
  rating: "Rating",
  progression: "Progression sur 30 jours",
  activite: "Activité récente",
};

export interface Filtres {
  role: Role | null;
  region: string | null;
  /** Rating minimum : celui d'un palier, ou un nombre précis (recherche en langage naturel). */
  ratingMin: number | null;
  classesSeulement: boolean;
  disponible: boolean;
  sansEquipe: boolean;
  actifJours: ActiviteJours | null;
  enProgression: boolean;
  fiable: boolean;
  tri: Tri;
}

export type ParametresRecherche = Partial<
  Record<
    | "role"
    | "region"
    | "palier_min"
    | "rating_min"
    | "classes"
    | "disponible"
    | "sans_equipe"
    | "actif"
    | "progression"
    | "fiable"
    | "tri",
    string
  >
>;

/** Filtres lus dans l'adresse ; toute valeur inconnue est ignorée. */
export function lireFiltres(p: ParametresRecherche, paliers: { nom: string; ratingMin: number }[]): Filtres {
  const role = ROLES.find((r) => r === p.role) ?? null;
  const region = REGIONS.some((r) => r.code === p.region) ? p.region! : null;
  const palier = paliers.find((x) => x.nom === p.palier_min);
  const precis = p.rating_min && /^\d{1,4}$/.test(p.rating_min) ? Number(p.rating_min) : null;
  const ratingMin = Math.max(palier?.ratingMin ?? 0, precis ?? 0) || null;
  const actif = ACTIVITES_JOURS.find((j) => String(j) === p.actif) ?? null;
  const tri = TRIS.find((t) => t === p.tri) ?? "rating";
  return {
    role,
    region,
    ratingMin,
    classesSeulement: p.classes === "1",
    disponible: p.disponible === "1",
    sansEquipe: p.sans_equipe === "1",
    actifJours: actif,
    enProgression: p.progression === "1",
    fiable: p.fiable === "1",
    tri,
  };
}

export function filtresActifs(f: Filtres): boolean {
  return Boolean(
    f.role || f.region || f.ratingMin || f.classesSeulement || f.disponible || f.sansEquipe || f.actifJours || f.enProgression || f.fiable,
  );
}

/** « +42 », « −18 », « 0 » ; null sans tournoi classé sur 30 jours. */
export function formaterProgression(variation: number | null): string | null {
  if (variation === null) return null;
  const n = Math.round(variation);
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** « 12 parties · il y a 3 j », « aucune partie vérifiée en 90 jours ». */
export function resumeActivite(parties: number, derniere: string | null, maintenantMs: number): string {
  if (parties === 0 || !derniere) return "Aucune partie vérifiée en 90 jours";
  const jours = Math.floor((maintenantMs - new Date(derniere).getTime()) / 86_400_000);
  const quand = jours <= 0 ? "aujourd'hui" : jours === 1 ? "hier" : `il y a ${jours} j`;
  return `${parties} partie${parties > 1 ? "s" : ""} vérifiée${parties > 1 ? "s" : ""} · ${quand}`;
}

/**
 * Fiabilité en une ligne, comme le bloc du CV : rien sous
 * MINIMUM_FIABILITE matchs joués (ça ne dit rien du joueur).
 */
export function resumeFiabilite(d: { matchs_joues: number; forfaits: number; tournois_1v1: number; checkins: number }): string | null {
  if (d.matchs_joues < MINIMUM_FIABILITE) return null;
  const forfaits = d.forfaits === 0 ? "aucun forfait" : `${d.forfaits} forfait${d.forfaits > 1 ? "s" : ""}`;
  const checkin = d.tournois_1v1 >= 5 ? ` · check-in ${Math.round((d.checkins / d.tournois_1v1) * 100)} %` : "";
  return `${forfaits} sur ${d.matchs_joues} matchs${checkin}`;
}
