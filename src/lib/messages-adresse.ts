// Messages affichés d'après l'adresse (?message=, ?erreur=, ?coach=…) : une
// action du site redirige vers la page avec son texte. Contrôle du testeur
// du 11/10/2026 : n'importe qui pouvait fabriquer un lien qui fait « parler »
// le site (texte inventé dans un bandeau de réussite, sur un CV public).
// Le proxy (src/proxy.ts) ne garde ces textes que s'ils viennent d'une
// navigation interne au site (en-tête Sec-Fetch-Site: same-origin, posé par
// le navigateur lui-même ; à défaut, chez les navigateurs anciens qui ne
// l'envoient pas, l'en-tête Referer d'une page du site), ou s'ils sont l'un des retours prévus depuis un
// autre site (Stripe, lien de connexion), à leur page et sous leur nom.
// La destination après connexion (?suite=) en est aussi nettoyée
// (destinationInterne, src/lib/redirection.ts) : sinon le site lui-même y
// renverrait, en navigation interne.

export const PARAMETRES_MESSAGE = [
  "message",
  "erreur",
  "coach",
  "coachErreur",
  "reco",
  "recoErreur",
  "bourse",
  "bourseErreur",
  "liaison",
  "demande",
  "ignores",
] as const;

/** Textes qu'un retour depuis un autre site peut porter. */
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

/** Chaque retour externe n'est admis qu'à sa page et sous son nom de paramètre. */
const RETOURS_ADMIS: { chemin: string; parametre: string; texte: string }[] = [
  { chemin: "/moi", parametre: "message", texte: RETOURS_EXTERNES.abonnementEnCours },
  { chemin: "/connexion", parametre: "erreur", texte: RETOURS_EXTERNES.connexionImpossible },
  { chemin: "/moi/gains", parametre: "message", texte: RETOURS_EXTERNES.lienVersementExpire },
  { chemin: "/moi/gains", parametre: "message", texte: RETOURS_EXTERNES.identiteVerifiee },
  { chemin: "/moi/gains", parametre: "message", texte: RETOURS_EXTERNES.verificationIncomplete },
  { chemin: "/moi/gains", parametre: "erreur", texte: RETOURS_EXTERNES.versementIndisponible },
  { chemin: "/moi/gains", parametre: "erreur", texte: RETOURS_EXTERNES.aucunCompteVersement },
  { chemin: "/moi/gains", parametre: "erreur", texte: RETOURS_EXTERNES.stripeIndisponible },
];

/** Retire les paramètres de message de l'adresse ; vrai si quelque chose a été retiré. */
function retirer(url: URL, garder: (parametre: string, valeurs: string[]) => boolean): boolean {
  let retire = false;
  for (const parametre of PARAMETRES_MESSAGE) {
    const valeurs = url.searchParams.getAll(parametre);
    if (valeurs.length > 0 && !garder(parametre, valeurs)) {
      url.searchParams.delete(parametre);
      retire = true;
    }
  }
  return retire;
}

/** Vrai si l'adresse de la page précédente (Referer) est sur le même site. */
function memeOrigine(referer: string | null, url: URL): boolean {
  if (!referer) return false;
  try {
    return new URL(referer).origin === url.origin;
  } catch {
    return false;
  }
}

/** L'adresse sans les messages qui ne viennent pas du site, ou null s'il n'y a rien à retirer. */
export function sansMessagesForges(url: URL, secFetchSite: string | null, referer: string | null = null): URL | null {
  if (secFetchSite === "same-origin") return null;
  // Navigateur sans Sec-Fetch-Site (Safari avant la version 16.4, par
  // exemple) : la page d'où vient la visite fait foi. Un autre site ne peut
  // pas poser un Referer du nôtre (c'est le navigateur qui l'écrit). Si
  // l'en-tête Sec-Fetch-Site est présent, lui seul compte.
  if (secFetchSite === null && memeOrigine(referer, url)) return null;
  const propre = new URL(url);
  // Une seule valeur, et prévue pour cette page et ce nom (un doublon
  // « texte admis + texte piégé » serait affiché bout à bout).
  const retire = retirer(
    propre,
    (parametre, valeurs) =>
      valeurs.length === 1 &&
      RETOURS_ADMIS.some((r) => r.chemin === propre.pathname && r.parametre === parametre && r.texte === valeurs[0]),
  );
  return retire ? propre : null;
}

/**
 * Un chemin du site (« /joueur/x?coach=…#coach ») sans aucun paramètre de
 * message. Seule la partie après « ? » est réécrite : reconstruire le chemin
 * (new URL) simplifierait « /.//autre-site » en « //autre-site », lu par le
 * navigateur comme un autre site (contrôle de sécurité du 11/10/2026).
 */
export function cheminSansMessages(chemin: string): string {
  const diese = chemin.indexOf("#");
  const avantAncre = diese === -1 ? chemin : chemin.slice(0, diese);
  const ancre = diese === -1 ? "" : chemin.slice(diese);
  const question = avantAncre.indexOf("?");
  if (question === -1) return chemin;
  const parametres = new URLSearchParams(avantAncre.slice(question + 1));
  let retire = false;
  for (const parametre of PARAMETRES_MESSAGE) {
    if (parametres.has(parametre)) {
      parametres.delete(parametre);
      retire = true;
    }
  }
  if (!retire) return chemin;
  const reste = parametres.toString();
  return `${avantAncre.slice(0, question)}${reste ? `?${reste}` : ""}${ancre}`;
}
