"use client";

// Count-up utilisé sur les chiffres de preuve de l'accueil. N'anime rien
// tant que l'élément n'est pas visible ; affiche la valeur finale
// directement si `prefers-reduced-motion`.

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

interface CompteurAnimeProps {
  valeur: number;
  prefixe?: string;
  suffixe?: string;
}

export default function CompteurAnime({ valeur, prefixe = "", suffixe = "" }: CompteurAnimeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVue = useInView(ref, { once: true, margin: "-60px" });
  const reduitMotion = useReducedMotion();
  const [affiche, setAffiche] = useState(reduitMotion ? valeur : 0);

  useEffect(() => {
    if (!enVue) return;
    if (reduitMotion) {
      // setState différé au tick suivant : l'appeler de façon synchrone
      // dans le corps de l'effet déclenche des rendus en cascade (règle
      // react-hooks/set-state-in-effect).
      queueMicrotask(() => setAffiche(valeur));
      return;
    }
    const controls = animate(0, valeur, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setAffiche(Math.round(v)),
    });
    return () => controls.stop();
  }, [enVue, valeur, reduitMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefixe}
      {affiche}
      {suffixe}
    </span>
  );
}
