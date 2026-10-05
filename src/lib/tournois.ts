import type { Database } from "@/lib/supabase/types";
import { FUSEAU_PARIS } from "@/lib/tournois-auto/creneaux";

export type Statut = Database["public"]["Enums"]["tournament_status"];

export const STATUTS_PUBLICS = [
  "ouvert",
  "checkin",
  "en_cours",
  "termine",
  "annule",
] as const satisfies readonly Statut[];

export type StatutPublic = (typeof STATUTS_PUBLICS)[number];

export const LABEL_STATUT: Record<StatutPublic, string> = {
  ouvert: "Ouvert aux inscriptions",
  checkin: "Check-in",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

export const COULEUR_STATUT: Record<StatutPublic, string> = {
  ouvert: "text-accent",
  checkin: "text-accent",
  en_cours: "text-accent",
  termine: "text-muted",
  annule: "text-muted",
};

export function estStatutPublic(valeur: string | undefined): valeur is StatutPublic {
  return !!valeur && (STATUTS_PUBLICS as readonly string[]).includes(valeur);
}

export function estVisiblePubliquement(statut: Statut): statut is StatutPublic {
  return (STATUTS_PUBLICS as readonly string[]).includes(statut);
}

// Niveau de fiabilité d'un verdict — voir docs/moteur-resultats.md.
export type NiveauVerdict = Database["public"]["Enums"]["verdict_level"];

export const LABEL_NIVEAU: Record<NiveauVerdict, string> = {
  code_tournoi: "Code tournoi",
  historique: "Historique",
  manuel: "Manuel",
};

export const COULEUR_NIVEAU: Record<NiveauVerdict, string> = {
  code_tournoi: "text-accent",
  historique: "text-accent",
  manuel: "text-muted",
};

// Heure de Paris explicite : le serveur (Vercel) tourne en UTC. Sans fuseau,
// le Daily de 21h00 s'affichait « 19:00 » partout sauf sur l'accueil
// (audit du 27/09/2026, E5).
const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSEAU_PARIS,
});

export function formaterDate(iso: string) {
  return FORMAT_DATE.format(new Date(iso));
}

const PARTIES_DATE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: FUSEAU_PARIS,
});

export interface PartiesDate {
  /** « lun. » */
  jourSemaine: string;
  /** « 05 » */
  jour: string;
  /** « oct. » */
  mois: string;
  /** « 21:00 » */
  heure: string;
}

/**
 * Date d'un tournoi découpée pour un bloc de date (liste des tournois,
 * revue visuelle du 05/10/2026), en heure de Paris comme formaterDate.
 */
export function partiesDate(iso: string): PartiesDate {
  const p = Object.fromEntries(PARTIES_DATE.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { jourSemaine: p.weekday ?? "", jour: p.day ?? "", mois: p.month ?? "", heure: `${p.hour}:${p.minute}` };
}

/** Ordre de la liste des tournois : en direct, puis à venir (le plus proche d'abord), puis terminés (le plus récent d'abord). */
export function grouperTournois<T extends { statut: Statut; debute_le: string }>(
  tournois: T[],
): { enDirect: T[]; aVenir: T[]; termines: T[]; annules: T[] } {
  const parDate = (sens: 1 | -1) => (a: T, b: T) => sens * (Date.parse(a.debute_le) - Date.parse(b.debute_le));
  return {
    enDirect: tournois.filter((t) => t.statut === "en_cours").sort(parDate(1)),
    aVenir: tournois.filter((t) => t.statut === "ouvert" || t.statut === "checkin").sort(parDate(1)),
    termines: tournois.filter((t) => t.statut === "termine").sort(parDate(-1)),
    annules: tournois.filter((t) => t.statut === "annule").sort(parDate(-1)),
  };
}
