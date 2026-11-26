import Link from "next/link";
import type { ReactNode } from "react";

// Puce de filtre (harmonisation du 26/11/2026, validée par le porteur) :
// case encadrée pour FILTRER une liste (statut, région, palier). Pour
// naviguer DANS une page, utiliser des onglets soulignés (OngletsTournoi).
// Filtre actif : bordure et texte blancs, jamais verts (le vert est réservé
// à la preuve). Avant, chaque page avait sa version : texte nu (Divisions,
// Duo, À la demande), vert (Bilan), cases (Tournois, Tarifs).

interface PuceFiltreProps {
  href: string;
  actif: boolean;
  /** Puce resserrée pour les longues listes (codes de région). */
  compacte?: boolean;
  children: ReactNode;
}

export default function PuceFiltre({ href, actif, compacte = false, children }: PuceFiltreProps) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-bouton border font-texte text-[13px] font-semibold tracking-[2px] whitespace-nowrap uppercase transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
        compacte ? "px-3" : "px-4"
      } ${actif ? "border-text text-text" : "border-line-strong text-muted hover:border-[rgba(245,245,244,0.25)] hover:text-text"}`}
    >
      {children}
    </Link>
  );
}
