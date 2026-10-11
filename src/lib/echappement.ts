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

/**
 * Lien placé dans une notification (message privé Discord, push) : seulement
 * une adresse du site lui-même, faite de caractères d'adresse ordinaires.
 * Sinon, l'adresse du site (contrôle de sécurité du 10/10/2026 : un champ
 * caché de formulaire réécrit pouvait glisser un faux avertissement et un
 * lien masqué dans un message du bot officiel).
 */
export function lienSur(lien: string, base: string): string {
  const racine = base.replace(/\/+$/, "");
  // « Commence par l'adresse du site » ne suffit pas : najarena.fr.piege.example
  // commence aussi par najarena.fr. Il faut la suite exacte : / ? # ou rien.
  const duSite = lien === racine || [`${racine}/`, `${racine}?`, `${racine}#`].some((d) => lien.startsWith(d));
  // Après l'adresse du site, une liste fermée de caractères (11/10/2026) :
  // ni espace ni saut de ligne (texte ajouté au message), ni crochet ou
  // parenthèse (lien masqué), ni caractère invisible ou qui inverse le sens
  // d'écriture.
  const valide = duSite && /^[A-Za-z0-9\-._~/?#=&%+:,]*$/.test(lien.slice(racine.length));
  return valide ? lien : racine;
}
