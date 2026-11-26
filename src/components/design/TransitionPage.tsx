"use client";

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";

// Passage d'une page à l'autre (26/11/2026, validé par le porteur) : le
// contenu sort en fondu et le nouveau entre avec un léger glissement
// (globals.css, .fondu-page). Boîte clé sur l'adresse : l'animation ne joue
// qu'au CHANGEMENT de page, pas à chaque chargement partiel (écran
// d'attente, bloc qui arrive en différé) ni quand un filtre change la fin
// de l'adresse (?statut=…) — un premier essai sur « update » fondait la
// page quatre fois de suite pendant un seul passage.
// Navigateurs sans View Transitions : changement de page direct.

export default function TransitionPage({ children }: { children: ReactNode }) {
  const chemin = usePathname();
  return (
    <ViewTransition key={chemin} enter="fondu-page" exit="fondu-page" default="none">
      {children}
    </ViewTransition>
  );
}
