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
