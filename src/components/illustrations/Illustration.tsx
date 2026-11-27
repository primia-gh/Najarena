import { DESSINS, type NomDessin } from "./dessins";

// Illustration maison (étape 4 du plan « site plus visuel », 27/11/2026).
// Décorative : aria-hidden, elle ne remplace jamais un texte. Rendue par le
// serveur. Le contenu vient uniquement de dessins.ts (SVG statique écrit
// par nous, jamais de donnée de visiteur), d'où l'insertion directe.

export type { NomDessin };

export default function Illustration({ nom, className = "" }: { nom: NomDessin; className?: string }) {
  const dessin = DESSINS[nom];
  return (
    <svg
      viewBox={dessin.viewBox}
      className={`block h-auto ${className}`}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: dessin.svg }}
    />
  );
}
