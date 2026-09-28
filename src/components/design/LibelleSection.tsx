import type { ReactNode } from "react";

// Libellé de section (MASTER §3) : « 01 — COMMENT ÇA MARCHE », numéro en
// vert, le reste en gris. Sans numéro, sert d'eyebrow simple.
// `as` : balise réelle. Par défaut un <p> (eyebrow au-dessus d'un vrai
// titre) ; "h2"/"h3" quand le libellé est lui-même le titre de la section,
// pour que la hiérarchie des titres reste continue (h1 → h2 → h3).

interface LibelleSectionProps {
  numero?: string;
  as?: "p" | "h2" | "h3";
  /** Pour nommer une section (aria-labelledby). */
  id?: string;
  className?: string;
  children: ReactNode;
}

export default function LibelleSection({ numero, as: Balise = "p", id, className = "", children }: LibelleSectionProps) {
  return (
    <Balise id={id} className={`font-texte text-libelle font-medium uppercase text-muted ${className}`}>
      {numero && <span className="text-accent">{numero}</span>}
      {numero && " — "}
      {children}
    </Balise>
  );
}
