// Matching duo (18/11/2026, roadmap phase 3) : un joueur publie son poste,
// les postes qu'il cherche chez son duo, ses créneaux et son objectif ;
// /lol/duo lui propose d'abord les joueurs de sa région qui jouent le poste
// qu'il cherche, aux mêmes heures, et de niveau proche quand les deux sont
// classés (rating Najarena, lu dans des parties vérifiées). Logique pure,
// testée dans duo.test.ts ; les règles (compte vérifié, une demande en
// attente par paire, plafonds) sont appliquées par la base (docs/schema.sql).

import { LABEL_ROLE, ROLES, type Role } from "@/lib/roles";

export const DUREE_ANNONCE_DUO_JOURS = 14;
export const DUREE_DEMANDE_DUO_JOURS = 7;
export const DEMANDES_DUO_PAR_JOUR = 10;
export const DELAI_APRES_REFUS_JOURS = 30;
export const MESSAGE_DUO_MAX = 200;

export const CRENEAUX_DUO = [
  "semaine_journee",
  "semaine_soir",
  "semaine_nuit",
  "weekend_journee",
  "weekend_soir",
  "weekend_nuit",
] as const;
export type CreneauDuo = (typeof CRENEAUX_DUO)[number];

export const LABEL_CRENEAU: Record<CreneauDuo, string> = {
  semaine_journee: "Semaine · journée",
  semaine_soir: "Semaine · soir",
  semaine_nuit: "Semaine · nuit",
  weekend_journee: "Week-end · journée",
  weekend_soir: "Week-end · soir",
  weekend_nuit: "Week-end · nuit",
};

/** Heures de chaque moment de la journée (heure de Paris), pour le formulaire. */
export const HEURES_MOMENT = {
  journee: "avant 18 h",
  soir: "18 h – 23 h",
  nuit: "après 23 h",
} as const;

export const OBJECTIFS_DUO = ["classees", "equipe", "loisir"] as const;
export type ObjectifDuo = (typeof OBJECTIFS_DUO)[number];

export const LABEL_OBJECTIF: Record<ObjectifDuo, string> = {
  classees: "Monter en classées",
  equipe: "Former le noyau d'une équipe",
  loisir: "Jouer pour le plaisir",
};

export const DETAIL_OBJECTIF: Record<ObjectifDuo, string> = {
  classees: "Un partenaire régulier pour les parties classées en duo.",
  equipe: "Commencer à deux, puis compléter une équipe pour les tournois 5v5 et Clash.",
  loisir: "Des parties sans enjeu, avec quelqu'un de son niveau.",
};

export interface AnnonceDuo {
  profileId: string;
  poste: Role;
  postesCherches: Role[];
  creneaux: CreneauDuo[];
  objectif: ObjectifDuo;
  /** Rating Najarena, seulement pour un joueur classé. */
  rating: number | null;
}

export interface Compatibilite {
  /** Chacun joue le poste que l'autre cherche. */
  reciproque: boolean;
  creneauxCommuns: CreneauDuo[];
  memeObjectif: boolean;
  /** Écart de rating, seulement si les deux joueurs sont classés. */
  ecart: number | null;
  score: number;
}

/** Au-delà, les niveaux sont trop éloignés pour un duo équilibré. */
export const ECART_PROCHE = 200;
export const ECART_ELOIGNE = 500;

export function estRole(valeur: unknown): valeur is Role {
  return typeof valeur === "string" && (ROLES as string[]).includes(valeur);
}
export function estCreneau(valeur: unknown): valeur is CreneauDuo {
  return typeof valeur === "string" && (CRENEAUX_DUO as readonly string[]).includes(valeur);
}
export function estObjectif(valeur: unknown): valeur is ObjectifDuo {
  return typeof valeur === "string" && (OBJECTIFS_DUO as readonly string[]).includes(valeur);
}

/**
 * Compatibilité de `autre` pour `moi`, ou null s'il n'est pas une
 * proposition : il doit jouer un poste que je cherche et partager au moins
 * un de mes créneaux. La région est déjà la même (la page ne charge que la
 * région du joueur).
 */
export function compatibilite(moi: AnnonceDuo, autre: AnnonceDuo): Compatibilite | null {
  if (autre.profileId === moi.profileId) return null;
  if (!moi.postesCherches.includes(autre.poste)) return null;
  const creneauxCommuns = CRENEAUX_DUO.filter((c) => moi.creneaux.includes(c) && autre.creneaux.includes(c));
  if (creneauxCommuns.length === 0) return null;

  const reciproque = autre.postesCherches.includes(moi.poste);
  const memeObjectif = autre.objectif === moi.objectif;
  const ecart = moi.rating !== null && autre.rating !== null ? Math.round(Math.abs(moi.rating - autre.rating)) : null;

  let score = 0;
  if (reciproque) score += 4;
  score += Math.min(creneauxCommuns.length, 3);
  if (memeObjectif) score += 2;
  if (ecart !== null) {
    if (ecart <= 100) score += 3;
    else if (ecart <= ECART_PROCHE) score += 2;
    else if (ecart <= 350) score += 1;
    else if (ecart > ECART_ELOIGNE) score -= 2;
  }
  return { reciproque, creneauxCommuns, memeObjectif, ecart, score };
}

/**
 * Propositions triées : meilleur score, puis plus petit écart de niveau
 * connu, puis ordre d'origine (annonce la plus récente d'abord).
 */
export function propositionsDuo<T extends AnnonceDuo>(
  moi: AnnonceDuo,
  annonces: T[],
): Array<{ annonce: T; compatibilite: Compatibilite }> {
  return annonces
    .map((annonce, rang) => ({ annonce, compatibilite: compatibilite(moi, annonce), rang }))
    .filter((p): p is { annonce: T; compatibilite: Compatibilite; rang: number } => p.compatibilite !== null)
    .sort((a, b) => {
      if (a.compatibilite.score !== b.compatibilite.score) return b.compatibilite.score - a.compatibilite.score;
      const ea = a.compatibilite.ecart ?? Number.POSITIVE_INFINITY;
      const eb = b.compatibilite.ecart ?? Number.POSITIVE_INFINITY;
      if (ea !== eb) return ea - eb;
      return a.rang - b.rang;
    })
    .map(({ annonce, compatibilite }) => ({ annonce, compatibilite }));
}

/** Raisons affichées sous une proposition : ce qui fonde l'appariement, rien d'autre. */
export function raisonsCompatibilite(moi: AnnonceDuo, autre: AnnonceDuo, c: Compatibilite): string[] {
  const raisons: string[] = [];
  raisons.push(
    c.reciproque
      ? `Postes complémentaires : ${LABEL_ROLE[autre.poste]} et ${LABEL_ROLE[moi.poste]}, chacun cherche l'autre`
      : `Joue ${LABEL_ROLE[autre.poste]}, le poste que tu cherches`,
  );
  raisons.push(
    c.creneauxCommuns.length === 1
      ? `Un créneau en commun : ${LABEL_CRENEAU[c.creneauxCommuns[0]].toLowerCase()}`
      : `${c.creneauxCommuns.length} créneaux en commun : ${c.creneauxCommuns.map((x) => LABEL_CRENEAU[x].toLowerCase()).join(", ")}`,
  );
  if (c.memeObjectif) raisons.push(`Même objectif : ${LABEL_OBJECTIF[moi.objectif].toLowerCase()}`);
  if (c.ecart !== null) {
    raisons.push(
      c.ecart > ECART_ELOIGNE
        ? `Niveaux éloignés : ${c.ecart} points d'écart`
        : `${c.ecart <= ECART_PROCHE ? "Niveaux proches" : "Écart de niveau"} : ${c.ecart} points (ratings vérifiés)`,
    );
  }
  return raisons;
}

const MESSAGES_REFUS_DUO: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi pour chercher un duo.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : impossible de chercher un duo.",
  COMPTE_RIOT_REQUIS: "Il faut un compte Riot vérifié : c'est lui qui fixe ta région et ton niveau.",
  POSTE_INVALIDE: "Choisis ton poste.",
  POSTES_CHERCHES_INVALIDES: "Choisis de 1 à 4 postes pour ton duo, autres que le tien.",
  CRENEAUX_INVALIDES: "Coche au moins un créneau où tu peux jouer.",
  OBJECTIF_INVALIDE: "Choisis ton objectif.",
  MESSAGE_TROP_LONG: `Ton message dépasse ${MESSAGE_DUO_MAX} caractères.`,
  TEXTE_INTERDIT: "Ton message contient un terme interdit sur Najarena : reformule-le.",
  DUO_SOI_MEME: "Tu ne peux pas te proposer en duo à toi-même.",
  ANNONCE_REQUISE: "Publie d'abord ton annonce : on ne contacte que des joueurs qui cherchent aussi.",
  ANNONCE_INTROUVABLE: "Ce joueur ne cherche plus de duo.",
  REGION_DIFFERENTE: "Vous ne jouez pas sur le même serveur.",
  DEJA_EN_CONTACT: "Vous avez déjà une conversation : écris-lui depuis ta messagerie.",
  DEMANDE_DEJA_EN_COURS: "Une demande entre vous attend déjà une réponse.",
  DEMANDE_REFUSEE_RECEMMENT: `Ce joueur a décliné ta demande : tu pourras le recontacter ${DELAI_APRES_REFUS_JOURS} jours après.`,
  LIMITE_DEMANDES_DUO: `Tu as envoyé ${DEMANDES_DUO_PAR_JOUR} demandes en 24 h : attends des réponses.`,
  DEMANDE_INTROUVABLE: "Cette demande n'existe pas.",
  NON_DESTINATAIRE: "Cette demande ne t'est pas adressée.",
  DEMANDE_DEJA_TRAITEE: "Cette demande a déjà reçu une réponse ou a été retirée.",
  DEMANDE_EXPIREE: `Cette demande a expiré (${DUREE_DEMANDE_DUO_JOURS} jours sans réponse).`,
  DEMANDEUR_INDISPONIBLE: "Ce joueur n'est plus disponible.",
};

/** Message lisible pour une erreur renvoyée par la base. */
export function messageRefusDuo(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS_DUO).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS_DUO[code] : parDefaut;
}
