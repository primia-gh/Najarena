// Ligues écoles et universités (04/10/2026, analyse concurrentielle de
// l'audit : Battlefy) et tournois réservés aux membres d'une communauté
// (les « hubs » de FACEIT). La base applique les règles (definir_ecole,
// preparer_verification_ecole, confirmer_verification_ecole,
// classement_ecoles, eligible_tournoi_reserve — docs/schema.sql) ; ce
// fichier sert à l'affichage et aux actions.

export const DOMAINES_ECOLE_MAX = 5;
/** Le classement inter-écoles fait la moyenne des 5 meilleurs ratings. */
export const ETUDIANTS_CLASSEMENT_ECOLES = 5;
export const DUREE_CODE_ECOLE_MINUTES = 15;
export const CODES_ECOLE_PAR_HEURE = 3;

export type TypeCommunaute = "communaute" | "ecole";

export function typeCommunaute(type: string | null | undefined): TypeCommunaute {
  return type === "ecole" ? "ecole" : "communaute";
}

/**
 * Domaines saisis par le fondateur (séparés par des virgules, des espaces
 * ou des retours à la ligne), normalisés comme en base : minuscules, sans
 * arobase, sans doublon.
 */
export function lireDomaines(saisie: string): string[] {
  const domaines = saisie
    .split(/[\s,;]+/)
    .map((d) => d.replace(/^@+/, "").toLowerCase())
    .filter((d) => d !== "");
  return [...new Set(domaines)].sort();
}

/** « @etu.univ-x.fr, @univ-x.fr » : les adresses acceptées, telles qu'affichées. */
export function libelleDomaines(domaines: string[]): string {
  return domaines.map((d) => `@${d}`).join(", ");
}

/**
 * Vrai si l'adresse est sur un des domaines de l'école ou sur l'un de leurs
 * sous-domaines (etu.univ-x.fr pour univ-x.fr) — même règle qu'en base.
 */
export function adresseAcceptee(email: string, domaines: string[]): boolean {
  const adresse = email.trim().toLowerCase();
  if (adresse.length > 200 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(adresse)) return false;
  const domaine = adresse.split("@")[1];
  return domaines.some((d) => domaine === d || domaine.endsWith(`.${d}`));
}

export interface EcoleClassee {
  slug: string;
  nom: string;
  couleur: string;
  verifies: number;
  classes: number;
  moyenne: number | null;
}

/**
 * Classement inter-écoles, déjà trié par la base : les écoles qui ont 5
 * membres vérifiés et classés d'abord, par moyenne de leurs 5 meilleurs
 * ratings officiels ; les autres sont « en constitution », sans rang.
 */
export function classementEcoles(
  lignes: {
    slug: string;
    nom: string;
    couleur: string;
    verifies: number;
    classes: number;
    moyenne_top5: number | string | null;
  }[],
): { classees: (EcoleClassee & { rang: number })[]; enConstitution: EcoleClassee[] } {
  const ecoles = lignes.map((l) => ({
    slug: l.slug,
    nom: l.nom,
    couleur: l.couleur,
    verifies: l.verifies,
    classes: l.classes,
    moyenne: l.moyenne_top5 === null ? null : Number(l.moyenne_top5),
  }));
  return {
    classees: ecoles.filter((e) => e.moyenne !== null).map((e, i) => ({ ...e, rang: i + 1 })),
    enConstitution: ecoles.filter((e) => e.moyenne === null),
  };
}

const MESSAGES_REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi d'abord.",
  GESTION_RESERVEE: "Seul le fondateur de la communauté indique les adresses de l'établissement.",
  DOMAINES_ECOLE: `Indique de 1 à ${DOMAINES_ECOLE_MAX} noms de domaine.`,
  DOMAINE_INVALIDE: "Un des domaines n'est pas valide (exemple attendu : etu.univ-exemple.fr).",
  DOMAINE_GRAND_PUBLIC:
    "Une messagerie grand public (Gmail, Outlook, Orange…) ne prouve rien : indique le domaine des adresses de l'établissement.",
  NOM_INTERDIT: "Un des domaines n'est pas accepté (propos interdits).",
  PAS_UNE_ECOLE: "Cette communauté n'est pas une école.",
  NON_MEMBRE: "Rejoins d'abord la communauté.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  EMAIL_INVALIDE: "Cette adresse e-mail n'est pas valide.",
  DOMAINE_NON_ACCEPTE: "Ce n'est pas une adresse de l'établissement : regarde les adresses acceptées.",
  EMAIL_DEJA_UTILISE: "Cette adresse a déjà servi à vérifier un autre compte.",
  TROP_DE_CODES: `Trop de codes demandés : ${CODES_ECOLE_PAR_HEURE} par heure au plus. Réessaie plus tard.`,
  AUCUNE_VERIFICATION: "Aucun code en attente : demande d'abord un code.",
  CODE_EXPIRE: `Ce code a expiré (il vaut ${DUREE_CODE_ECOLE_MINUTES} minutes) : demandes-en un nouveau.`,
  TROP_D_ESSAIS: "Trop d'essais pour ce code : demandes-en un nouveau.",
};

export function messageRefusEcole(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS[code] : parDefaut;
}

/** À qui un tournoi réservé est ouvert : « membres de X » ou « membres vérifiés de X ». */
export function publicReserve(communaute: { nom: string; type: string | null }): string {
  return typeCommunaute(communaute.type) === "ecole"
    ? `membres vérifiés de ${communaute.nom} (adresse de l'établissement)`
    : `membres de ${communaute.nom}`;
}
