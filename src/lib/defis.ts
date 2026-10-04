// Défis entre joueurs (28/09/2026, audit N16 et N18). La base applique les
// règles (lancer_defi, creer_duel… docs/schema.sql) ; ce fichier sert à
// l'affichage : états d'un défi, messages des refus de la base.

export const DUREE_DEFI_HEURES = 24;
export const DUREE_INVITATION_JOURS = 7;
export const DEFIS_OUVERTS_MAX = 5;
export const DEFIS_EN_COURS_MAX = 3;

const MESSAGES_REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi pour jouer un défi.",
  DEFI_SOI_MEME: "Tu ne peux pas te défier toi-même.",
  CONDITION_INVALIDE: "Règle de victoire inconnue.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : impossible de jouer un défi.",
  COMPTE_RIOT_REQUIS:
    "Il faut un compte Riot vérifié aux deux joueurs : c'est lui qui permet de lire le résultat chez Riot.",
  LIMITE_DEFIS: `Tu as déjà ${DEFIS_OUVERTS_MAX} défis en attente de réponse : attends une réponse ou retire-en un.`,
  JOUEUR_INTROUVABLE: "Ce joueur n'existe pas.",
  ADVERSAIRE_SANS_COMPTE_RIOT: "Ce joueur n'a pas encore de compte Riot vérifié : il ne peut pas être défié pour l'instant.",
  REGION_DIFFERENTE: "Vous ne jouez pas dans la même région : un défi se joue sur un même serveur.",
  DEFI_DEJA_PROPOSE: "Un défi entre vous attend déjà une réponse.",
  DEFI_INTROUVABLE: "Ce défi n'existe pas.",
  NON_DESTINATAIRE: "Ce défi ne t'est pas adressé.",
  DEFI_DEJA_TRAITE: "Ce défi a déjà reçu une réponse.",
  DEFI_EXPIRE: "Ce défi a expiré.",
  TROP_DE_DEFIS_EN_COURS: `L'un de vous a déjà ${DEFIS_EN_COURS_MAX} défis en cours : jouez-les d'abord.`,
  AUCUN_ARBITRE: "Les défis ne sont pas encore ouverts (aucun arbitre désigné).",
};

/** Message lisible pour une erreur renvoyée par la base. */
export function messageRefusDefi(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS[code] : parDefaut;
}

export type EtatDefi = "en_attente" | "accepte" | "refuse" | "annule" | "expire";

export function etatDefi(statut: string, expireLe: string, maintenant: Date): EtatDefi {
  if (statut === "accepte" || statut === "refuse" || statut === "annule") return statut;
  return new Date(expireLe).getTime() > maintenant.getTime() ? "en_attente" : "expire";
}

export const LIBELLE_ETAT_DEFI: Record<EtatDefi, string> = {
  en_attente: "En attente de réponse",
  accepte: "Accepté",
  refuse: "Refusé",
  annule: "Retiré",
  expire: "Expiré",
};
