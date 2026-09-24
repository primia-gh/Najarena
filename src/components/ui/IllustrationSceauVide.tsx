import type { CSSProperties } from "react";

// Illustration décorative d'état vide — reprend à l'identique la couronne
// de crans de SceauFiabilite.tsx (calibrage 0%), en repli quand il n'y a
// encore aucune donnée à afficher (classement fermé, aucun joueur classé,
// Riot ID non lié). Le repère qui tourne autour de la couronne est le
// seul mouvement continu de cette illustration — voir globals.css.
const NOMBRE_CRANS = 48;
const CX = 80;
const CY = 80;
const R_INT = 58;
const R_EXT = 64;
const RAYON_ANNEAU_1 = 50;
const RAYON_ANNEAU_2 = 42;

function arrondir(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export default function IllustrationSceauVide({ className = "" }: { className?: string }) {
  const crans = Array.from({ length: NOMBRE_CRANS }, (_, i) => {
    const angle = (i / NOMBRE_CRANS) * Math.PI * 2 - Math.PI / 2;
    return {
      x1: arrondir(CX + Math.cos(angle) * R_INT),
      y1: arrondir(CY + Math.sin(angle) * R_INT),
      x2: arrondir(CX + Math.cos(angle) * R_EXT),
      y2: arrondir(CY + Math.sin(angle) * R_EXT),
    };
  });

  const angleScanner = -Math.PI / 2;
  const circonference1 = 2 * Math.PI * RAYON_ANNEAU_1;
  const circonference2 = 2 * Math.PI * RAYON_ANNEAU_2;

  return (
    <svg
      viewBox="0 0 160 160"
      className={`h-28 w-28 shrink-0 ${className}`}
      role="img"
      aria-label="Sceau de fiabilité, non calibré"
    >
      {crans.map((c, i) => (
        <line
          key={i}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke="var(--color-muted)"
          strokeWidth="1.4"
          className="illustration-tick"
          style={{ "--i": i, "--op-cible": 0.22 } as CSSProperties}
        />
      ))}
      <circle
        cx={CX}
        cy={CY}
        r={RAYON_ANNEAU_1}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="1.4"
        opacity=".5"
        className="illustration-anneau"
        strokeDasharray={circonference1}
        style={{ "--longueur": circonference1 } as CSSProperties}
      />
      <circle
        cx={CX}
        cy={CY}
        r={RAYON_ANNEAU_2}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="1"
        opacity=".3"
        className="illustration-anneau"
        strokeDasharray={circonference2}
        style={{ "--longueur": circonference2, animationDelay: "0.15s" } as CSSProperties}
      />
      <circle cx={CX} cy={CY} r="3" fill="var(--color-muted)" opacity=".45" />
      <line
        x1={arrondir(CX + Math.cos(angleScanner) * R_INT)}
        y1={arrondir(CY + Math.sin(angleScanner) * R_INT)}
        x2={arrondir(CX + Math.cos(angleScanner) * (R_EXT + 3))}
        y2={arrondir(CY + Math.sin(angleScanner) * (R_EXT + 3))}
        stroke="var(--color-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="illustration-scanner"
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />
    </svg>
  );
}
