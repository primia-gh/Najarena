import { ORDRE_OFFRE, type Offre } from "@/lib/offres";

// Offre accordée par un abonnement Stripe (contrôle de sécurité du
// 19/11/2026) : déduite du prix réellement facturé, jamais des
// métadonnées de l'abonnement. Celles-ci gardent l'offre choisie au
// départ : un abonné passé d'Organisateur à Plus dans le portail Stripe
// aurait gardé Organisateur en ne payant que Plus.
//
// Un prix Stripe ne se modifie pas : changer un tarif, c'est créer un
// nouveau prix, et les anciens abonnés restent sur l'ancien. Chaque
// variable STRIPE_PRICE_* peut donc lister plusieurs prix séparés par des
// virgules : le premier sert aux nouvelles souscriptions, tous sont
// reconnus pour les abonnés en cours.

export type OffrePayante = Exclude<Offre, "gratuit">;

/** Valeur brute des variables STRIPE_PRICE_* de chaque offre. */
export function prixParOffre(): Record<OffrePayante, string | undefined> {
  return {
    verifie: process.env.STRIPE_PRICE_VERIFIE,
    elite: process.env.STRIPE_PRICE_ELITE,
    organisateur: process.env.STRIPE_PRICE_ORGANISATEUR,
  };
}

/** Identifiants d'une variable « price_a, price_b », sans vide. */
export function listePrix(valeur: string | undefined): string[] {
  return (valeur ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Prix des nouvelles souscriptions : le premier de la liste. */
export function prixCourant(valeur: string | undefined): string | undefined {
  return listePrix(valeur)[0];
}

/** Offre correspondant à un prix Stripe, ou null si ce prix n'est celui d'aucune offre. */
export function offreDepuisPrix(
  prixId: string | null | undefined,
  prix: Record<OffrePayante, string | undefined>,
): OffrePayante | null {
  if (!prixId) return null;
  const trouvee = (Object.entries(prix) as [OffrePayante, string | undefined][]).find(([, valeur]) =>
    listePrix(valeur).includes(prixId),
  );
  return trouvee ? trouvee[0] : null;
}

/**
 * Compte Najarena servi par un abonnement (contrôle de sécurité du
 * 22/11/2026) : seulement l'étiquette `profile_id` que notre serveur pose
 * sur l'abonnement à sa création (`demarrerAbonnement`), la même qui sert
 * à retirer l'offre à la résiliation. Un abonnement créé hors du site (lien
 * de paiement, grille de tarifs du tableau de bord Stripe) n'en a pas : il
 * n'accorde rien, sinon sa résiliation ne retirerait jamais l'offre. La
 * référence de la session de paiement, si elle est donnée, doit désigner
 * le même compte.
 */
export function joueurDeLAbonnement(
  profileIdAbonnement: string | null | undefined,
  referenceSession?: string | null,
): string | null {
  if (!profileIdAbonnement) return null;
  if (referenceSession && referenceSession !== profileIdAbonnement) return null;
  return profileIdAbonnement;
}

/** Un abonnement qui compte encore (il n'a pas pris fin) : un nouveau serait un doublon. */
export function abonnementEnVie(statut: string): boolean {
  return statut !== "canceled" && statut !== "incomplete_expired";
}

/** Abonnement payé ou en période d'essai (d'après son seul statut). */
export function abonnementEnCours(statut: string): boolean {
  return statut === "active" || statut === "trialing";
}

/**
 * Abonnement qui donne droit à son offre : payé ou en essai, et pas mis en
 * pause (contrôle de sécurité du 23/11/2026 : une pause des paiements garde
 * le statut « active » sans rien encaisser).
 */
export function abonnementPaye(abonnement: { status: string; pause_collection?: unknown }): boolean {
  return abonnementEnCours(abonnement.status) && !abonnement.pause_collection;
}

/**
 * Vérification quotidienne des abonnements (23/11/2026) : ce qu'il faut
 * faire de l'offre d'un abonné d'après l'état de son abonnement relu chez
 * Stripe, au cas où un message de Stripe (webhook) se serait perdu.
 * - Une offre donnée à la main par un administrateur n'est jamais retirée ;
 *   elle n'est remplacée que par une offre payée plus haute (comme le fait
 *   le webhook).
 * - Abonnement qui n'est plus en cours (impayé, résilié…) → offre retirée.
 * - Abonnement en cours → offre du prix facturé, accordée si elle manque
 *   ou diffère. Un prix qui n'est celui d'aucune offre est seulement
 *   signalé : un réglage STRIPE_PRICE_* erroné ne doit pas retirer d'un
 *   coup l'offre de tous les abonnés (le webhook, lui, la retire à
 *   l'événement suivant de cet abonné).
 */
export type DecisionVerification =
  | { action: "aucune" }
  | { action: "accorder"; offre: OffrePayante }
  | { action: "retirer" }
  | { action: "signaler"; raison: "prix_inconnu" };

export function decisionVerification(entree: {
  statutStripe: string;
  /** Paiements mis en pause chez Stripe (le statut reste « active »). */
  enPause?: boolean;
  prixFacture: string | null | undefined;
  prix: Record<OffrePayante, string | undefined>;
  offreActuelle: { offre: string; manuelle: boolean } | null;
}): DecisionVerification {
  const { statutStripe, enPause, prixFacture, prix, offreActuelle } = entree;
  const paye = abonnementPaye({ status: statutStripe, pause_collection: enPause ? true : null });
  if (offreActuelle?.manuelle) {
    const offrePayee = paye ? offreDepuisPrix(prixFacture, prix) : null;
    return offrePayee && ORDRE_OFFRE[offrePayee] > ORDRE_OFFRE[offreActuelle.offre as Offre]
      ? { action: "accorder", offre: offrePayee }
      : { action: "aucune" };
  }
  if (!paye) {
    return offreActuelle ? { action: "retirer" } : { action: "aucune" };
  }
  const offre = offreDepuisPrix(prixFacture, prix);
  if (!offre) return { action: "signaler", raison: "prix_inconnu" };
  return offreActuelle?.offre === offre ? { action: "aucune" } : { action: "accorder", offre };
}

/** Au moins un prix d'offre est réglé (sinon la vérification ne sert à rien et ne touche à rien). */
export function prixConfigures(prix: Record<OffrePayante, string | undefined>): boolean {
  return Object.values(prix).some((valeur) => listePrix(valeur).length > 0);
}

type AbonnementResume = {
  id: string;
  status: string;
  created: number;
  metadata?: Record<string, string> | null;
  pause_collection?: unknown;
};

/**
 * Parmi les abonnements d'un client Stripe, celui qui compte pour ce compte
 * Najarena (vérification quotidienne, 23/11/2026) : seulement ceux que notre
 * serveur a étiquetés pour lui (joueurDeLAbonnement) ; d'abord un abonnement
 * payé, puis un abonnement encore en vie (impayé, en attente : il facture
 * encore), puis celui déjà suivi, puis le plus récent — à chaque fois le
 * plus récent d'abord.
 * Un premier abonnement ou un réabonnement dont le message de paiement s'est
 * perdu est ainsi retrouvé, même si la base ne connaît pas encore son
 * identifiant.
 */
export function abonnementCourant<T extends AbonnementResume>(
  abonnements: T[],
  profileId: string,
  suiviId: string | null,
): T | null {
  const siens = abonnements
    .filter((a) => joueurDeLAbonnement(a.metadata?.profile_id) === profileId)
    .sort((a, b) => b.created - a.created);
  return (
    siens.find((a) => abonnementPaye(a)) ??
    siens.find((a) => abonnementEnVie(a.status)) ??
    siens.find((a) => a.id === suiviId) ??
    siens[0] ??
    null
  );
}
