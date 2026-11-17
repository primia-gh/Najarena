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
