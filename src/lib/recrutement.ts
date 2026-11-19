import { LABEL_ROLE, type Role } from "@/lib/roles";
import { estRole } from "@/lib/duo";
import { CHOIX_MINIMUM, libelleNiveau } from "@/lib/niveau-tournoi";

// Équipes qui recrutent (19/11/2026). Toutes les règles — capitaine,
// compte Riot vérifié, même région, niveau, une candidature en attente par
// équipe, plafond, délai après un refus, équipe de cinq au plus — sont
// appliquées par la base (docs/schema.sql) ; ici, les libellés et messages.

export const DUREE_ANNONCE_RECRUTEMENT_JOURS = 30;
export const DUREE_CANDIDATURE_JOURS = 14;
export const CANDIDATURES_PAR_JOUR = 10;
export const MESSAGE_RECRUTEMENT_MAX = 300;

/** Choix du niveau minimum d'une annonce (seuils de paliers). */
export const CHOIX_NIVEAU_RECRUTEMENT = CHOIX_MINIMUM;

/** « Or et plus », ou nul (tous niveaux). */
export function libelleNiveauRecrutement(min: number | null): string | null {
  return libelleNiveau(min, null);
}

/** Postes valides d'une liste quelconque, sans doublon, dans l'ordre du jeu. */
export function postesValides(valeurs: unknown[]): Role[] {
  const choisis = new Set(valeurs.filter(estRole));
  return (Object.keys(LABEL_ROLE) as Role[]).filter((r) => choisis.has(r));
}

/** « Support, Jungle » */
export function libellePostes(postes: string[]): string {
  return postes.filter(estRole).map((p) => LABEL_ROLE[p]).join(", ");
}

const MESSAGES: Record<string, string> = {
  NON_CAPITAINE: "Seul le capitaine de l'équipe peut faire cela.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  COMPTE_RIOT_REQUIS: "Lie et vérifie ton compte Riot d'abord : il fixe ta région et permet de lire tes résultats.",
  EQUIPE_COMPLETE: "L'équipe a déjà cinq joueurs.",
  POSTES_INVALIDES: "Choisis au moins un poste recherché.",
  NIVEAU_INVALIDE: "Niveau minimum inconnu.",
  MESSAGE_TROP_LONG: `Le message fait ${MESSAGE_RECRUTEMENT_MAX} caractères au plus.`,
  ANNONCE_INTROUVABLE: "Cette équipe ne recrute plus.",
  REGION_DIFFERENTE: "Cette équipe recrute sur une autre région que celle de ton compte Riot vérifié.",
  DEJA_MEMBRE: "Tu fais déjà partie de cette équipe.",
  POSTE_NON_RECHERCHE: "Ce poste n'est pas recherché par l'équipe.",
  NIVEAU_INSUFFISANT:
    "Ton rating de la saison est sous le niveau demandé par l'équipe (1500 si tu n'as pas encore joué).",
  CANDIDATURE_EN_COURS: "Ta candidature à cette équipe attend déjà une réponse.",
  CANDIDATURE_REFUSEE_RECEMMENT: "Cette équipe a décliné ta candidature il y a moins de 30 jours.",
  CANDIDATURE_RECENTE: "Une seule candidature à la même équipe par 7 jours, comptés depuis l'envoi.",
  LIMITE_CANDIDATURES: `Tu as envoyé ${CANDIDATURES_PAR_JOUR} candidatures ces dernières 24 h : réessaie plus tard.`,
  CANDIDATURE_INTROUVABLE: "Cette candidature n'existe plus.",
  CANDIDATURE_DEJA_TRAITEE: "Cette candidature a déjà reçu une réponse.",
  CANDIDATURE_EXPIREE: `Cette candidature a expiré (${DUREE_CANDIDATURE_JOURS} jours sans réponse).`,
  CANDIDAT_INDISPONIBLE: "Ce joueur n'est plus disponible.",
  JOUEUR_INDISPONIBLE: "Ce joueur n'est plus disponible.",
  TEXTE_INTERDIT: "Ce message contient un terme refusé : reformule-le.",
};

/** Message lisible d'un refus de la base. */
export function messageRecrutement(erreur: string | undefined | null, parDefaut: string): string {
  const texte = erreur ?? "";
  const code = Object.keys(MESSAGES).find((c) => texte.includes(c));
  return code ? MESSAGES[code] : parDefaut;
}
