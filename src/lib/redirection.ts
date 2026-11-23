import { cheminSansMessages } from "@/lib/messages-adresse";

// Destination interne après une connexion ou un lien reçu par e-mail
// (/auth/callback). Collée telle quelle après l'origine du site,
// « @exemple.com » ou « .exemple.com » envoyait vers un autre site (audit du
// 27/09/2026, F2) : seul un chemin du site est accepté.
// Les messages éventuels (?coach=, ?message=…) en sont retirés : le site y
// renverrait lui-même, ils s'afficheraient comme venant de lui (contrôle de
// sécurité du 11/10/2026, src/lib/messages-adresse.ts).
// Pas de segment « . » ou « .. » (même encodé) ni d'antislash : un chemin
// normalisé en « //autre-site » mènerait ailleurs.
const CHEMIN_DU_SITE = /^\/(?![/\\])[^@\s\\]*$/;
const SEGMENT_POINT = /(^|\/)(\.|%2e){1,2}(\/|\?|#|$)/i;

export function destinationInterne(demande: string | null, parDefaut = "/moi"): string {
  if (!demande || !CHEMIN_DU_SITE.test(demande) || SEGMENT_POINT.test(demande)) return parDefaut;
  const propre = cheminSansMessages(demande);
  return CHEMIN_DU_SITE.test(propre) && !SEGMENT_POINT.test(propre) ? propre : parDefaut;
}

/**
 * Ajoute ?message= à une destination déjà passée par destinationInterne
 * (vérification d'un compte Riot sous le niveau 30, 22/11/2026). Le chemin
 * est reconstruit puis contrôlé de nouveau : jamais une adresse hors du
 * site, sinon la page par défaut. Une page qui n'affiche pas ce message
 * l'ignore ; le proxy le retire d'un lien venu d'ailleurs.
 */
export function avecMessage(chemin: string, message: string, parDefaut = "/moi"): string {
  const interne = destinationInterne(chemin, "");
  if (!interne) return parDefaut;
  const url = new URL(interne, "https://najarena.invalid");
  if (url.origin !== "https://najarena.invalid") return parDefaut;
  url.searchParams.set("message", message);
  const resultat = `${url.pathname}${url.search}${url.hash}`;
  return CHEMIN_DU_SITE.test(resultat.split("?")[0]) && !SEGMENT_POINT.test(url.pathname) ? resultat : parDefaut;
}
