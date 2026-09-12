import type { ReactNode } from "react";

// Titre de section du registre clair avec liseré laiton — remplace les h2
// nus répétés sur chaque page (Inscrits, Bracket, Membres, Mes équipes...).
export default function SectionTitre({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-l-4 border-laiton pl-3 font-display text-xl font-extrabold tracking-tight text-encre">
      {children}
    </h2>
  );
}
