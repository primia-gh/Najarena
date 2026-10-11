// Messages affichés d'après l'adresse (?message=, ?erreur=, ?coach=…) : une
// action du site redirige vers la page avec son texte. Contrôle du testeur
// du 11/10/2026 : n'importe qui pouvait fabriquer un lien qui fait « parler »
// le site (texte inventé dans un bandeau de réussite, sur un CV public).
// Le proxy (src/proxy.ts) ne garde ces textes que s'ils viennent d'une
// navigation interne au site (en-tête Sec-Fetch-Site: same-origin, posé par
// le navigateur lui-même), ou s'ils font partie des retours prévus depuis un
// autre site (Stripe, lien de connexion reçu par e-mail).

export const PARAMETRES_MESSAGE = [
  "message",
  "erreur",
  "coach",
  "coachErreur",
  "reco",
  "recoErreur",
  "bourse",
  "bourseErreur",
] as const;

/** Textes qu'un retour depuis un autre site peut porter : seuls admis hors navigation interne. */
export const RETOURS_EXTERNES = {
  abonnementEnCours: "Abonnement en cours de confirmation.",
  lienVersementExpire: "Le lien a expiré : recommence la vérification.",
  connexionImpossible: "Connexion impossible, réessaie.",
  versementIndisponible: "Le versement des gains n'est pas encore disponible.",
  aucunCompteVersement: "Aucun compte de versement ouvert.",
  identiteVerifiee: "Identité vérifiée par Stripe : ton gain te sera versé par un administrateur.",
  verificationIncomplete: "Vérification incomplète ou en cours chez Stripe : reprends-la si Stripe te le demande.",
  stripeIndisponible: "Stripe est indisponible pour l'instant : l'état de ta vérification sera mis à jour plus tard.",
} as const;

const ADMIS = new Set<string>(Object.values(RETOURS_EXTERNES));

/** L'adresse sans les messages qui ne viennent pas du site, ou null s'il n'y a rien à retirer. */
export function sansMessagesForges(url: URL, secFetchSite: string | null): URL | null {
  if (secFetchSite === "same-origin") return null;
  const propre = new URL(url);
  let retire = false;
  for (const parametre of PARAMETRES_MESSAGE) {
    const valeur = propre.searchParams.get(parametre);
    if (valeur !== null && !ADMIS.has(valeur)) {
      propre.searchParams.delete(parametre);
      retire = true;
    }
  }
  return retire ? propre : null;
}
