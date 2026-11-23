// Adresses de notification push acceptées (contrôle de sécurité du
// 21/11/2026, F2) : seulement celles des services de push des navigateurs,
// en https. Sinon le serveur enverrait des requêtes vers n'importe quelle
// adresse choisie par un joueur. Chrome (Google, dont jmt17.google.com sur
// certains appareils), Firefox, Safari (tout *.push.apple.com, comme Apple
// le demande) et Edge. Même règle en base
// (controler_abonnement_push, docs/schema.sql).
export const MOTIF_ADRESSE_PUSH =
  /^https:\/\/(fcm\.googleapis\.com|jmt17\.google\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)?push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

/** Adresse d'un service de push de navigateur connu, en https, 1 000 caractères au plus. */
export function estAdressePushValide(adresse: string): boolean {
  return adresse.length <= 1000 && MOTIF_ADRESSE_PUSH.test(adresse);
}
