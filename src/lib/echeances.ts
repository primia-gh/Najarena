// Calendrier des échéances (03/10/2026, audit N24) : Clash, lu dans l'API
// Riot, et Nexus Tour ou autre, saisis par un administrateur avec leur lien
// officiel. Jamais une date inventée. Logique pure, testée dans
// echeances.test.ts.

import type { TournoiClashRiot } from "./riot";

export type TypeEcheance = "clash" | "nexus_tour" | "autre";

export const LIBELLE_TYPE_ECHEANCE: Record<TypeEcheance, string> = {
  clash: "Clash",
  nexus_tour: "Nexus Tour",
  autre: "Compétition",
};

export function typeEcheance(type: string): TypeEcheance {
  return type === "clash" || type === "nexus_tour" ? type : "autre";
}

/** « bilgewater » + « day_4 » → « Clash Bilgewater — jour 4 ». */
export function libelleClash(nameKey: string, nameKeySecondary: string): string {
  const mots = (texte: string) =>
    texte
      .split("_")
      .filter(Boolean)
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
      .join(" ");
  const jour = /^day_(\d+)$/.exec(nameKeySecondary);
  const secondaire = jour ? `jour ${jour[1]}` : mots(nameKeySecondary);
  return `Clash ${mots(nameKey)}${secondaire ? ` — ${secondaire}` : ""}`.slice(0, 80);
}

export interface LigneEcheanceClash {
  type: "clash";
  nom: string;
  region: string;
  debut_le: string;
  source: "riot";
  cle_externe: string;
}

/**
 * Lignes à enregistrer pour les tournois Clash d'une région : une par phase
 * à venir et non annulée (un Clash se joue souvent sur deux jours).
 */
export function echeancesDepuisClash(
  region: string,
  tournois: TournoiClashRiot[],
  maintenant: Date,
): LigneEcheanceClash[] {
  return tournois.flatMap((t) =>
    t.schedule
      .filter((phase) => !phase.cancelled && phase.startTime > maintenant.getTime())
      .map((phase) => ({
        type: "clash" as const,
        nom: libelleClash(t.nameKey, t.nameKeySecondary),
        region,
        debut_le: new Date(phase.startTime).toISOString(),
        source: "riot" as const,
        cle_externe: `clash-${region}-${t.id}-${phase.id}`,
      })),
  );
}

/**
 * Synchronisation du calendrier Clash : pendant les 5 premières minutes de
 * 0 h, 6 h, 12 h et 18 h (UTC) — la tâche passe toutes les 5 minutes, soit
 * quatre lectures par jour.
 */
export function doitSynchroniserClash(maintenant: Date): boolean {
  return maintenant.getUTCHours() % 6 === 0 && maintenant.getUTCMinutes() < 5;
}
