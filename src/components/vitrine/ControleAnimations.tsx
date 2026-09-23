"use client";

import { useEffect, useSyncExternalStore } from "react";
import { abonnerPause, animationsEnPause, definirPause, restaurerPause } from "@/lib/pause-animations";

// Bouton « Pause / Animer » de l'accueil : fige ou relance toutes les
// animations de la page (voir lib/pause-animations.ts pour le pourquoi).

export default function ControleAnimations({ className = "" }: { className?: string }) {
  const pause = useSyncExternalStore(abonnerPause, animationsEnPause, () => false);

  useEffect(() => {
    restaurerPause();
  }, []);

  return (
    <button
      type="button"
      onClick={() => definirPause(!pause)}
      aria-pressed={pause}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-bouton px-3 text-mini font-semibold text-muted uppercase transition-colors duration-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        {pause ? <path d="M3 1.5v9l7-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
      </svg>
      {pause ? "Animer" : "Pause"}
      <span className="sr-only">{pause ? " — relancer les animations" : " — mettre les animations en pause"}</span>
    </button>
  );
}
