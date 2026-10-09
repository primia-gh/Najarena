// Tournois à la demande (09/10/2026, idée en réserve n°11). Un joueur
// indique les heures où il est libre ; dès que SEUIL_A_LA_DEMANDE joueurs de
// la même région ont indiqué la même heure, un tournoi 1v1 s'ouvre à cette
// heure-là et ils y sont inscrits. La base applique toutes les règles
// (declarer_disponibilite, ouvrir_tournois_a_la_demande, docs/schema.sql) ;
// ce fichier sert à l'affichage et reprend ses seuils — changer l'un
// impose de changer l'autre. Logique pure, testée dans a-la-demande.test.ts.

import { ajouterJours, instantParis, jourParis } from "@/lib/tournois-auto/creneaux";
import { JOUEURS_MIN_TOURNOI_CLASSE } from "@/lib/tournoi-classe";

/** Valeur de tournaments.creneau_auto d'un tournoi à la demande. */
export const CRENEAU_A_LA_DEMANDE = "a-la-demande";
/** Joueurs disponibles à la même heure pour ouvrir un tournoi (= minimum d'un tournoi classé). */
export const SEUIL_A_LA_DEMANDE = JOUEURS_MIN_TOURNOI_CLASSE;
export const HEURE_PREMIERE = 12;
export const HEURE_DERNIERE = 23;
export const AVANCE_MIN_MINUTES = 90;
export const AVANCE_MAX_HEURES = 72;
export const DISPONIBILITES_MAX = 8;

/** Tournoi « officiel » (quotidien créé par Najarena) : un tournoi à la demande ne l'est pas. */
export function estOfficiel(creneauAuto: string | null): boolean {
  return creneauAuto !== null && creneauAuto !== CRENEAU_A_LA_DEMANDE;
}

export interface HeureProposee {
  /** Instant de début (ISO). */
  debut: string;
  /** « 21:00 » */
  heure: string;
}

export interface JourPropose {
  /** « 2026-10-10 » (jour à Paris) */
  jour: string;
  heures: HeureProposee[];
}

/**
 * Heures qu'on peut indiquer maintenant, jour par jour : heures pleines de
 * 12 h à 23 h (Paris), de 90 minutes à 3 jours à l'avance.
 */
export function heuresProposees(maintenant: Date): JourPropose[] {
  const t = maintenant.getTime();
  const min = t + AVANCE_MIN_MINUTES * 60_000;
  const max = t + AVANCE_MAX_HEURES * 3_600_000;
  const jours: JourPropose[] = [];
  const premierJour = jourParis(maintenant);
  for (let d = 0; d <= Math.ceil(AVANCE_MAX_HEURES / 24); d++) {
    const jour = ajouterJours(premierJour, d);
    const heures: HeureProposee[] = [];
    for (let h = HEURE_PREMIERE; h <= HEURE_DERNIERE; h++) {
      const heure = `${String(h).padStart(2, "0")}:00`;
      const debut = instantParis(jour, heure);
      if (debut.getTime() >= min && debut.getTime() <= max) heures.push({ debut: debut.toISOString(), heure });
    }
    if (heures.length > 0) jours.push({ jour, heures });
  }
  return jours;
}

const REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi pour indiquer tes disponibilités.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  COMPTE_RIOT_REQUIS: "Il faut un compte Riot vérifié : c'est lui qui fixe ta région et permet de lire tes résultats.",
  HEURE_INVALIDE: `Choisis une heure pleine entre ${HEURE_PREMIERE} h et ${HEURE_DERNIERE} h, de 90 minutes à 3 jours à l'avance.`,
  TOURNOI_DEJA_PREVU: "Un tournoi est déjà prévu à cette heure : inscris-toi directement.",
  LIMITE_DISPONIBILITES: `Tu as déjà indiqué ${DISPONIBILITES_MAX} heures à venir : retires-en une d'abord.`,
};

export function messageRefusDisponibilite(erreur: string): string {
  const code = Object.keys(REFUS).find((c) => erreur.includes(c));
  return code ? REFUS[code] : "Impossible d'enregistrer ta disponibilité pour l'instant.";
}
