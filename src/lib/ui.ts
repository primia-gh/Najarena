// Classes partagées des pages qui n'ont pas été refaites une à une. Même
// mode d'emploi qu'avant (mêmes noms, mêmes paramètres), traduit en
// identité « Venin » le 24/09/2026 : les pages converties automatiquement
// passent ainsi au nouveau style sans qu'on touche à leur code. Pour du
// nouveau code, préférer lib/design.ts et components/design/.
import { classeBoutonContour, classeBoutonPrincipal } from "@/lib/design";

// Les noms d'accent historiques sont conservés (les pages les passent en
// dur) ; seule leur couleur change : « sceau » (attention, erreur, litige)
// devient rouge, « atteste » et « laiton » (vérifié, mis en avant) vert.
export type AccentCarte = "sceau" | "atteste" | "ardoise" | "laiton" | "none";

const BORDURE_ACCENT: Record<AccentCarte, string> = {
  sceau: "border-l-danger",
  atteste: "border-l-accent",
  ardoise: "border-l-line-strong",
  laiton: "border-l-accent",
  none: "border-l-line",
};

/**
 * Carte standard : panneau MASTER §5 avec un liseré gauche coloré selon le
 * statut (rouge = attention / erreur, vert = vérifié / mis en avant).
 */
export function classeCarte(accent: AccentCarte = "none", interactive = false): string {
  return [
    "panneau border-l-[3px] p-4",
    BORDURE_ACCENT[accent],
    interactive
      ? "transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const ACCENT_DEPUIS_COULEUR: Record<string, AccentCarte> = {
  "text-accent": "atteste",
  "text-muted": "ardoise",
  "text-danger": "sceau",
};

/** Traduit une classe text-* (COULEUR_NIVEAU / COULEUR_STATUT) en accent de carte. */
export function accentDepuisCouleur(couleur: string): AccentCarte {
  return ACCENT_DEPUIS_COULEUR[couleur] ?? "none";
}

/** Bouton principal : vert, texte noir (MASTER §6). */
export function classeBoutonPrimaire(): string {
  return classeBoutonPrincipal();
}

/** Bouton secondaire : contour blanc à 25 %. */
export function classeBoutonSecondaire(): string {
  return classeBoutonContour();
}
