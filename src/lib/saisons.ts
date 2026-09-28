import { FUSEAU_PARIS } from "@/lib/tournois-auto/creneaux";

// Saisons visibles (28/09/2026, audit N14) : le moteur changeait déjà de
// saison (soft reset, src/lib/classement-actions.ts), rien ne le montrait.

const MOIS_ANNEE = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: FUSEAU_PARIS });
const JOUR_MOIS = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU_PARIS });

/** « septembre 2026 – décembre 2026 » */
export function periodeSaison(debutLe: string, finLe: string): string {
  return `${MOIS_ANNEE.format(new Date(debutLe))} – ${MOIS_ANNEE.format(new Date(finLe))}`;
}

/** « 18 décembre 2026 » */
export function dateLongue(iso: string): string {
  return JOUR_MOIS.format(new Date(iso));
}

/** Jours pleins restants avant la fin (0 le dernier jour, null si passée). */
export function joursRestants(finLe: string, maintenant = new Date()): number | null {
  const ecart = new Date(finLe).getTime() - maintenant.getTime();
  if (ecart < 0) return null;
  return Math.floor(ecart / 86_400_000);
}

export function libelleJoursRestants(jours: number | null): string {
  if (jours === null) return "Terminée";
  if (jours === 0) return "Dernier jour";
  return `Encore ${jours} jour${jours > 1 ? "s" : ""}`;
}
