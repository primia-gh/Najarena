// Arène 1v1 à la demande (03/10/2026, audit N19) : un joueur entre dans la
// file de sa région, le site lui trouve un adversaire de niveau proche et
// ouvre un duel (même salle de match et même lecture Riot qu'un défi). La
// base fait l'appariement (rejoindre_arene, apparier_arene, docs/schema.sql) ;
// ce fichier reprend la même formule pour l'afficher.

import { messageRefusDefi } from "@/lib/defis";

export const ECART_ARENE_BASE = 100;
export const ECART_ARENE_PAR_MINUTE = 20;
export const ECART_ARENE_MAX = 500;
export const EXPIRATION_ARENE_MINUTES = 30;

/**
 * Écart de rating toléré entre deux joueurs : 100, plus la moitié du plus
 * grand RD (un niveau encore incertain peut affronter plus large), plus 20
 * par minute d'attente du plus ancien, 500 au plus. Même formule que
 * public.ecart_arene.
 */
export function ecartArene(rdA: number, rdB: number, attenteMinutes: number): number {
  return Math.min(
    ECART_ARENE_MAX,
    ECART_ARENE_BASE + Math.max(rdA, rdB) / 2 + ECART_ARENE_PAR_MINUTE * Math.max(attenteMinutes, 0),
  );
}

/** Minutes écoulées depuis l'entrée en file (0 si l'heure est à venir). */
export function minutesEnFile(entreeLe: string, maintenant: Date): number {
  return Math.max(0, Math.floor((maintenant.getTime() - new Date(entreeLe).getTime()) / 60000));
}

const MESSAGES_ARENE: Record<string, string> = {
  DEJA_EN_FILE: "Tu es déjà dans la file de l'arène.",
  DUEL_EN_COURS: "Tu as déjà un duel en cours : joue-le avant de revenir dans l'arène.",
  AUCUN_ARBITRE: "L'arène n'est pas encore ouverte (aucun arbitre désigné).",
  COMPTE_RIOT_REQUIS:
    "Il faut un compte Riot vérifié pour entrer dans l'arène : c'est lui qui permet de lire le résultat.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : impossible d'entrer dans l'arène.",
};

/** Message lisible pour un refus de la base. */
export function messageRefusArene(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_ARENE).find((c) => erreur.includes(c));
  return code ? MESSAGES_ARENE[code] : messageRefusDefi(erreur, parDefaut);
}
