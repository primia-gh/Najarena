"use client";

// Apparition au défilement de la nouvelle identité (MASTER §7 : apparitions
// 300–450 ms) : fondu + léger glissement vers le haut, une seule fois.
//
// Sans bibliothèque depuis le 26/11/2026 (audit web, U6) : la bibliothèque
// motion pesait ~40 Ko compressés sur chaque page pour ce seul effet. Le
// navigateur signale l'entrée à l'écran (IntersectionObserver) et la
// feuille de style fait le fondu (globals.css, [data-apparition]).
//
// Même élément rendu pour tous (règle CLAUDE.md §7, corrigé le 05/10/2026) :
// masqué en attendant le défilement par la feuille de style, affiché
// d'emblée sans mouvement si prefers-reduced-motion vaut « reduce » ou si
// JavaScript est désactivé (<noscript> du layout).
//
// Attention : la règle [data-apparition] de globals.css fixe « transition »
// et elle l'emporte sur les classes Tailwind. Ne pas mettre de classe
// transition-*, translate-* ou d'effet hover animé sur l'Apparition
// elle-même : les placer sur un élément enfant.

import { useEffect, useRef, type ReactNode } from "react";

interface ApparitionProps {
  children: ReactNode;
  /** Décalage en secondes, pour échelonner les éléments d'une même rangée. */
  delai?: number;
  className?: string;
}

export default function Apparition({ children, delai = 0, className }: ApparitionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some((e) => e.isIntersecting)) return;
        // Attribut posé hors de React : React ne le gère pas, il ne
        // l'effacera pas au rendu suivant.
        element.dataset.visible = "";
        observateur.disconnect();
      },
      // Comme avant : apparaît quand le bloc dépasse de 60 px dans l'écran.
      { rootMargin: "-60px" },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-apparition=""
      className={className}
      style={delai ? { transitionDelay: `${delai}s` } : undefined}
    >
      {children}
    </div>
  );
}
