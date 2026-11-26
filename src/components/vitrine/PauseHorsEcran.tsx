"use client";

import { useEffect } from "react";

// Boucles décoratives de l'accueil figées quand elles sont hors de l'écran
// (audit web du 26/11/2026, U7) : 43 animations tournaient en continu,
// visibles ou non, et occupaient le processeur d'un téléphone en
// permanence. Chaque bloc marqué data-boucle reçoit data-hors-ecran tant
// qu'il n'est pas visible ; la feuille de style (globals.css) fige alors
// ses animations. Indépendant du bouton « Pause » (data-animations), qui
// fige tout, visible ou non.

export default function PauseHorsEcran() {
  useEffect(() => {
    const blocs = document.querySelectorAll<HTMLElement>("[data-boucle]");
    if (blocs.length === 0) return;
    const observateur = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        const bloc = e.target as HTMLElement;
        if (e.isIntersecting) delete bloc.dataset.horsEcran;
        else bloc.dataset.horsEcran = "";
      }
    });
    blocs.forEach((b) => observateur.observe(b));
    return () => observateur.disconnect();
  }, []);
  return null;
}
