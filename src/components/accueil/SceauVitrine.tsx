"use client";

// Vitrine animée du sceau de fiabilité (élément signature, CLAUDE.md §7),
// jusqu'ici visible seulement sur la fiche joueur — mise en avant sur
// l'accueil pour incarner "ton niveau, vérifié". Réutilise le vrai
// composant SceauFiabilite (aucune duplication du tracé de la couronne),
// seule la teinte change pour le registre nuit.

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import SceauFiabilite from "@/components/SceauFiabilite";

interface SceauVitrineProps {
  cible?: number;
}

export default function SceauVitrine({ cible = 68 }: SceauVitrineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const enVue = useInView(ref, { once: true, margin: "-100px" });
  const reduitMotion = useReducedMotion();
  const [pct, setPct] = useState(reduitMotion ? cible : 0);

  useEffect(() => {
    if (!enVue) return;
    if (reduitMotion) {
      // Voir CompteurAnime.tsx : setState différé pour éviter la règle
      // react-hooks/set-state-in-effect.
      queueMicrotask(() => setPct(cible));
      return;
    }
    const controls = animate(0, cible, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setPct(Math.round(v)),
    });
    return () => controls.stop();
  }, [enVue, cible, reduitMotion]);

  return (
    <div ref={ref} className="mx-auto w-fit [&_svg]:h-56 [&_svg]:w-56">
      <SceauFiabilite calibrationPct={pct} couleur="var(--nuit-laiton)" />
    </div>
  );
}
