import type { Database } from "@/lib/supabase/types";

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

export function formaterDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
