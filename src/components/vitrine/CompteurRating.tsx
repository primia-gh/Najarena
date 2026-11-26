"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { abonnerPause, animationsEnPause } from "@/lib/pause-animations";

// Chiffre de la boucle « ton rating monte » (maquette Boucle-Rating) : monte
// de `depart` à `arrivee` en ~2,6 s puis recommence, calé sur le cycle de
// 5 s de la courbe (50 pas de 100 ms). Mouvement réduit : valeur finale
// affichée directement, aucune minuterie. Bouton « Pause » de l'accueil :
// le chiffre se fige comme les animations CSS. Hors de l'écran : la minuterie
// s'arrête (audit web du 26/11/2026, U7) au lieu de recalculer le chiffre
// dix fois par seconde pour rien.

const PAS_PAR_CYCLE = 50;
const REQUETE_MOUVEMENT_REDUIT = "(prefers-reduced-motion: reduce)";

function abonnerMouvementReduit(rappel: () => void) {
  const requete = window.matchMedia(REQUETE_MOUVEMENT_REDUIT);
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}

export default function CompteurRating({ depart, arrivee }: { depart: number; arrivee: number }) {
  const [valeur, setValeur] = useState(depart);
  const mouvementReduit = useSyncExternalStore(
    abonnerMouvementReduit,
    () => window.matchMedia(REQUETE_MOUVEMENT_REDUIT).matches,
    () => false,
  );
  const pause = useSyncExternalStore(abonnerPause, animationsEnPause, () => false);
  const ref = useRef<HTMLSpanElement>(null);
  const [aLEcran, setALEcran] = useState(false);
  // Gardé entre deux pauses : le chiffre reprend là où il s'était arrêté,
  // comme la courbe CSS à côté, au lieu de repartir du bas.
  const pasRef = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Même bloc que celui que PauseHorsEcran observe pour figer la courbe
    // (section data-boucle) : chiffre et courbe s'arrêtent ensemble.
    const cible = element.closest<HTMLElement>("[data-boucle]") ?? element;
    const observateur = new IntersectionObserver((entrees) => {
      setALEcran(entrees.some((e) => e.isIntersecting));
    });
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, []);

  useEffect(() => {
    if (mouvementReduit || pause || !aLEcran) return;
    const minuterie = window.setInterval(() => {
      const pas = (pasRef.current + 1) % PAS_PAR_CYCLE;
      pasRef.current = pas;
      const k = Math.min(1, Math.max(0, (pas - 4) / 26));
      const adouci = 1 - Math.pow(1 - k, 3);
      setValeur(Math.round(depart + (arrivee - depart) * adouci));
    }, 100);
    return () => window.clearInterval(minuterie);
  }, [depart, arrivee, mouvementReduit, pause, aLEcran]);

  return (
    <span ref={ref} className="font-titre text-[72px] leading-[0.9] font-black tabular-nums">
      {mouvementReduit ? arrivee : valeur}
    </span>
  );
}
