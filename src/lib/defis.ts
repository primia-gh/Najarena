// Défis entre joueurs (28/09/2026, audit N16 et N18). La base applique les
// règles (lancer_defi, creer_duel… docs/schema.sql) ; ce fichier sert à
// l'affichage : états d'un défi, messages des refus de la base.

export const DUREE_DEFI_HEURES = 24;
export const DUREE_INVITATION_JOURS = 7;
export const DEFIS_OUVERTS_MAX = 5;
export const DEFIS_EN_COURS_MAX = 3;
/** Défis lancés par 24 h, retirés compris (consommer_limite('defi'), contrôle M6 du 22/11/2026). */
export const DEFIS_PAR_JOUR_MAX = 20;
/**
 * Duels classés (défis, arène, divisions) par joueur et par 24 h, au-delà
 * en amical (22/11/2026, contrôle de sécurité M4 : limite les victoires
 * qu'un joueur peut se fabriquer contre ses propres comptes). Même nombre
 * en base (duel_classe_possible).
 */
export const DUELS_CLASSES_PAR_JOUR_MAX = 5;

const MESSAGES_REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi pour jouer un défi.",
  DEFI_SOI_MEME: "Tu ne peux pas te défier toi-même.",
  CONDITION_INVALIDE: "Règle de victoire inconnue.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : impossible de jouer un défi.",
  COMPTE_RIOT_REQUIS:
    "Il faut un compte Riot vérifié aux deux joueurs : c'est lui qui permet de lire le résultat chez Riot.",
  LIMITE_DEFIS: `Tu as déjà ${DEFIS_OUVERTS_MAX} défis en attente de réponse : attends une réponse ou retire-en un.`,
  DEFIS_DU_JOUR_ATTEINTS: `Tu as lancé ${DEFIS_PAR_JOUR_MAX} défis en 24 heures, défis retirés compris : réessaie dans quelques heures.`,
  JOUEUR_INTROUVABLE: "Ce joueur n'existe pas.",
  ADVERSAIRE_SANS_COMPTE_RIOT: "Ce joueur n'a pas encore de compte Riot vérifié : il ne peut pas être défié pour l'instant.",
  REGION_DIFFERENTE: "Vous ne jouez pas dans la même région : un défi se joue sur un même serveur.",
  DEFI_DEJA_PROPOSE: "Un défi entre vous attend déjà une réponse.",
  DEFI_INTROUVABLE: "Ce défi n'existe pas.",
  NON_DESTINATAIRE: "Ce défi ne t'est pas adressé.",
  DEFI_DEJA_TRAITE: "Ce défi a déjà reçu une réponse.",
  DEFI_EXPIRE: "Ce défi a expiré.",
  TROP_DE_DEFIS_EN_COURS: `L'un de vous a déjà ${DEFIS_EN_COURS_MAX} défis en cours : jouez-les d'abord.`,
  // Blocage entre les deux joueurs (19/11/2026) : message neutre.
  JOUEUR_INDISPONIBLE: "Ce joueur n'est pas disponible pour un défi.",
  // Refusé par la base depuis le 18/11/2026 (creer_duel), comme le duel de division.
  MATCH_OUVERT_ENTRE_VOUS:
    "Vous avez déjà un match en cours l'un contre l'autre (tournoi ou défi) : jouez-le d'abord, puis acceptez ce défi. Une même partie ne compte qu'une fois.",
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
