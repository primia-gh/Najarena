import type { ReactNode } from "react";

// Icônes au trait de la nouvelle identité (MASTER §6 : SVG au trait
// 1.5–2 px, jamais d'emoji). Décoratives par défaut (aria-hidden) : le
// texte à côté porte le sens. Passer `libelle` si l'icône est seule.

const TRACES = {
  coche: <path d="M20 6 9 17l-5-5" />,
  "fleche-droite": <path d="M5 12h14M13 6l6 6-6 6" />,
  "fleche-gauche": <path d="M19 12H5M11 6l-6 6 6 6" />,
  bouclier: <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />,
  joueur: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  partager: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  crayon: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  lecture: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m10 8 6 4-6 4z" />
    </>
  ),
  cadenas: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  oeil: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  horloge: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  // Éclat à 4 branches des bandeaux défilants — seule forme pleine.
  eclat: <path d="M12 0 15 9 24 12 15 15 12 24 9 15 0 12 9 9Z" fill="currentColor" stroke="none" />,
} satisfies Record<string, ReactNode>;

export type NomIcone = keyof typeof TRACES;

interface IconeProps {
  nom: NomIcone;
  taille?: number;
  epaisseur?: number;
  libelle?: string;
  className?: string;
}

export default function Icone({ nom, taille = 16, epaisseur = 1.8, libelle, className = "" }: IconeProps) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={libelle ? "img" : undefined}
      aria-label={libelle}
      aria-hidden={libelle ? undefined : true}
    >
      {TRACES[nom]}
    </svg>
  );
}
