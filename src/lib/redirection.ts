import { cheminSansMessages } from "@/lib/messages-adresse";

// Destination interne après une connexion ou un lien reçu par e-mail
// (/auth/callback). Collée telle quelle après l'origine du site,
// « @exemple.com » ou « .exemple.com » envoyait vers un autre site (audit du
// 27/09/2026, F2) : seul un chemin du site est accepté.
// Les messages éventuels (?coach=, ?message=…) en sont retirés : le site y
// renverrait lui-même, ils s'afficheraient comme venant de lui (contrôle de
// sécurité du 11/10/2026, src/lib/messages-adresse.ts).
export function destinationInterne(demande: string | null, parDefaut = "/moi"): string {
  if (!demande) return parDefaut;
  return /^\/(?![/\\])[^@\s]*$/.test(demande) ? cheminSansMessages(demande) : parDefaut;
}
