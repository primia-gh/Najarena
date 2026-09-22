import type { ReactNode } from "react";

// Libellé de section (MASTER §3) : « 01 — COMMENT ÇA MARCHE », numéro en
// vert, le reste en gris. Sans numéro, sert d'eyebrow simple.

interface LibelleSectionProps {
  numero?: string;
  className?: string;
  children: ReactNode;
}

export default function LibelleSection({ numero, className = "", children }: LibelleSectionProps) {
  return (
    <p className={`font-texte text-libelle font-medium uppercase text-muted ${className}`}>
      {numero && <span className="text-accent">{numero}</span>}
      {numero && " — "}
      {children}
    </p>
  );
}
