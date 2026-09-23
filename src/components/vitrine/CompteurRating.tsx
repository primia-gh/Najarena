"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { abonnerPause, animationsEnPause } from "@/lib/pause-animations";

// Chiffre de la boucle « ton rating monte » (maquette Boucle-Rating) : monte
// de `depart` à `arrivee` en ~2,6 s puis recommence, calé sur le cycle de
// 5 s de la courbe (50 pas de 100 ms). Mouvement réduit : valeur finale
// affichée directement, aucune minuterie. Bouton « Pause » de l'accueil :
// le chiffre se fige comme les animations CSS.

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

  useEffect(() => {
    if (mouvementReduit || pause) return;
    let pas = 0;
    const minuterie = window.setInterval(() => {
      pas = (pas + 1) % PAS_PAR_CYCLE;
      const k = Math.min(1, Math.max(0, (pas - 4) / 26));
      const adouci = 1 - Math.pow(1 - k, 3);
      setValeur(Math.round(depart + (arrivee - depart) * adouci));
    }, 100);
    return () => window.clearInterval(minuterie);
  }, [depart, arrivee, mouvementReduit, pause]);

  return (
    <span className="font-titre text-[72px] leading-[0.9] font-black tabular-nums">
      {mouvementReduit ? arrivee : valeur}
    </span>
  );
}
