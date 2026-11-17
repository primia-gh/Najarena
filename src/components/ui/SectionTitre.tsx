import type { ReactNode } from "react";

// Titre de section des pages outils — même mode d'emploi qu'avant. Revue
// visuelle du 05/10/2026 : le filet vert à gauche et le titre en 24 px
// laissent place au libellé des pages refaites (profil, tournoi,
// classement) — 13 px en majuscules, gris, posé sur un filet : le vert
// reste rare (MASTER §2) et toutes les pages se lisent de la même façon.
export default function SectionTitre({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-b border-line-strong pb-4 font-texte text-libelle font-medium text-muted uppercase">
      {children}
    </h2>
  );
}
