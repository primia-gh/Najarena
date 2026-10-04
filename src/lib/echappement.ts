// Textes saisis par les utilisateurs (nom de tournoi, motif d'un verdict ou
// d'un litige, résolution…) insérés dans le HTML des e-mails et des
// notifications (28/09/2026, audit M5) : sans échappement, un organisateur
// pouvait glisser un faux bouton ou un lien d'hameçonnage dans un e-mail
// parti de l'adresse officielle de Najarena.

const ENTITES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** À appliquer à tout texte venant d'un utilisateur avant de l'insérer dans du HTML. */
export function echapperHtml(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ENTITES[c]);
}

/** Inverse d'echapperHtml, pour tirer un texte brut d'un HTML (notification push). */
export function decoderEntites(texte: string): string {
  return texte
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Même idée pour Discord : un nom de tournoi « [Réclame ton gain](https://…) »
 * s'afficherait sinon comme un lien masqué sur le salon officiel. Neutralise
 * la mise en forme Markdown de Discord (gras, liens masqués, citations,
 * titres…). Les mentions (@everyone) sont déjà coupées par allowed_mentions.
 */
export function echapperDiscord(texte: string): string {
  return texte
    .replace(/[\\*_~`|[\]]/g, (c) => `\\${c}`)
    .replace(/^(\s*)([>#-])/gm, "$1\\$2");
}
