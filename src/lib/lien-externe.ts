import { cheminSansMessages } from "@/lib/messages-adresse";

// Lien externe du CV (offre Vérifié et plus). Contrôles de sécurité du
// 12/10/2026 : le lien n'était pas vérifié du tout. Il est désormais refusé
// par la base s'il n'est pas une adresse web complète ou si la modération
// le refuse (verdict_lien_externe, docs/schema.sql), et filtré ici à
// l'enregistrement comme à l'affichage :
// - converti comme le ferait le navigateur (accents, espaces, nom de site
//   accentué en punycode) : https://fr.wikipedia.org/wiki/Étoile est admis ;
// - http ou https seulement (ni « javascript: », ni « data: », ni chemin
//   relatif), nom de site terminé par des lettres (ni adresse IP ni réseau
//   local), sans identifiant devant (« https://najarena.fr@piege.example »
//   mène à piege.example) ;
// - sans paramètre de message (?message=, ?erreur=…) : cliqué depuis le CV,
//   un lien vers le site lui-même ferait afficher un texte inventé
//   (src/lib/messages-adresse.ts).
// Le CV n'affiche que le nom du site (libelleLienExterne) : la vraie
// destination, lisible, sans paramètres ni chemin à rallonge.

/** Même règle que la base (verdict_lien_externe). */
const FORME_LIEN =
  /^https?:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.([A-Za-z]{2,63}|xn--[A-Za-z0-9-]+)(:[0-9]{1,5})?([/?#][!-~]*)?$/;

export const LIEN_EXTERNE_MAX = 300;

export const MESSAGE_LIEN_INVALIDE =
  "Lien refusé : indique l'adresse complète d'un site, qui commence par https:// (300 caractères au plus).";

export const MESSAGE_LIEN_INTERDIT =
  "Lien refusé : l'adresse contient un terme interdit, ou imite un site officiel (Najarena, Riot…). Choisis-en une autre.";

/** Le lien tel qu'il peut être enregistré et affiché, ou null s'il est refusé. */
export function lienExterneSur(lien: string | null | undefined): string | null {
  if (!lien) return null;
  const saisi = lien.trim();
  // La forme est vérifiée avant et après conversion : « twitter.com/x »
  // sans https:// n'est pas complété.
  if (!/^https?:\/\//i.test(saisi)) return null;
  let url: URL;
  try {
    url = new URL(saisi);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const propre = cheminSansMessages(url.href);
  if (propre.length > LIEN_EXTERNE_MAX || !FORME_LIEN.test(propre)) return null;
  return propre;
}

/** Texte affiché sur le CV : le nom du site, sans « www. ». */
export function libelleLienExterne(lien: string): string {
  try {
    return new URL(lien).hostname.replace(/^www\./, "");
  } catch {
    return lien;
  }
}
