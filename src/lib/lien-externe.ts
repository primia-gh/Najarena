import { cheminSansMessages } from "@/lib/messages-adresse";

// Lien externe du CV (offre Vérifié et plus). Contrôle de sécurité du
// 12/10/2026 : le lien n'était pas vérifié du tout. Il est désormais refusé
// par la base s'il n'est pas une adresse web complète (controler_lien_externe,
// docs/schema.sql), et filtré ici à l'enregistrement comme à l'affichage :
// - http ou https seulement (ni « javascript: », ni « data: », ni chemin
//   relatif) ;
// - pas d'identifiant avant le nom du site (« https://najarena.fr@piege.example »
//   mène à piege.example) ;
// - sans paramètre de message (?message=, ?erreur=…) : cliqué depuis le CV,
//   un lien vers le site lui-même ferait afficher un texte inventé
//   (src/lib/messages-adresse.ts).

/** Même règle que la base (controler_lien_externe). */
const FORME_LIEN = /^https?:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:[0-9]{1,5})?([/?#][!-~]*)?$/;

export const LIEN_EXTERNE_MAX = 300;

export const MESSAGE_LIEN_INVALIDE =
  "Lien refusé : indique une adresse complète qui commence par https://, sans espace (300 caractères au plus).";

/** Le lien tel qu'il peut être enregistré et affiché, ou null s'il est refusé. */
export function lienExterneSur(lien: string | null | undefined): string | null {
  if (!lien) return null;
  const propre = cheminSansMessages(lien.trim());
  if (propre.length > LIEN_EXTERNE_MAX || !FORME_LIEN.test(propre)) return null;
  return propre;
}
