import type { ReactNode } from "react";

// Titre de section des pages outils — même mode d'emploi qu'avant, mis au
// style « Venin » le 24/09/2026 : filet vert à gauche, Big Shoulders en
// MAJUSCULES (MASTER §3).
export default function SectionTitre({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-l-[3px] border-accent pl-3 font-titre text-2xl leading-none font-extrabold tracking-[1px] text-text uppercase">
      {children}
    </h2>
  );
}
