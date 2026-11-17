"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { abonnerPause, animationsEnPause } from "@/lib/pause-animations";
import { formaterChrono } from "@/lib/chrono-match";

// Chronomètre de la salle de match (audit N1), parti quand les deux joueurs
// sont prêts. Bouton « Pause » du site (WCAG 2.2.2) : le chiffre se fige,
// comme les animations. Pas de zone « live » : un lecteur d'écran ne
// l'annonce pas chaque seconde.

export default function ChronoMatch({ depuis }: { depuis: string }) {
  const [maintenant, setMaintenant] = useState<number | null>(null);
  const pause = useSyncExternalStore(abonnerPause, animationsEnPause, () => false);

  useEffect(() => {
    if (pause) return;
    const maj = () => setMaintenant(Date.now());
    const premier = window.setTimeout(maj, 0);
    const minuterie = window.setInterval(maj, 1000);
    return () => {
      window.clearTimeout(premier);
      window.clearInterval(minuterie);
    };
  }, [pause]);

  return (
    <span className="text-sm text-muted">
      Chrono{" "}
      <span className="font-semibold text-text tabular-nums">
        {maintenant === null ? "—" : formaterChrono(depuis, maintenant)}
      </span>
    </span>
  );
}
