"use client";

// Version miniature du sceau de fiabilité pour représenter un palier —
// même logique (l'anneau se ferme avec la progression), échelle réduite,
// affichée à côté d'un pseudo plutôt que seule sur la fiche joueur.

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

const RAYON = 15;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

interface CrestPalierProps {
  nom: string;
  couleur: string;
  progression: number; // 0-1 vers le palier suivant, 1 si palier maximal
}

export default function CrestPalier({ nom, couleur, progression }: CrestPalierProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVue = useInView(ref, { once: true, margin: "-40px" });
  const reduitMotion = useReducedMotion();
  const cible = Math.max(0, Math.min(1, progression));
  const [valeur, setValeur] = useState(reduitMotion ? cible : 0);

  useEffect(() => {
    if (!enVue) return;
    if (reduitMotion) {
      // Voir CompteurAnime.tsx : setState différé pour éviter la règle
      // react-hooks/set-state-in-effect.
      queueMicrotask(() => setValeur(cible));
      return;
    }
    const controls = animate(0, cible, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setValeur,
    });
    return () => controls.stop();
  }, [enVue, cible, reduitMotion]);

  return (
    <span ref={ref} className="inline-flex items-center gap-1.5" title={nom}>
      <svg viewBox="0 0 40 40" className="h-[22px] w-[22px] shrink-0" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={RAYON}
          fill="none"
          stroke={couleur}
          strokeWidth="2"
          strokeDasharray="2.2 2.6"
          opacity=".3"
        />
        {valeur > 0 && (
          <circle
            cx="20"
            cy="20"
            r={RAYON}
            fill="none"
            stroke={couleur}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray={CIRCONFERENCE}
            strokeDashoffset={CIRCONFERENCE * (1 - valeur)}
            transform="rotate(-90 20 20)"
          />
        )}
      </svg>
      <span
        className="font-texte tabular-nums text-[0.66rem] tracking-[0.06em] uppercase"
        style={{ color: couleur }}
      >
        {nom}
      </span>
    </span>
  );
}
