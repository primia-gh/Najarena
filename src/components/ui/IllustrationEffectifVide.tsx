import type { CSSProperties } from "react";

// Illustration décorative d'état vide — un roster 5v5 encore vide (aucune
// équipe, aucun coéquipier, aucun compte). Le poste capitaine, au centre,
// respire doucement en continu — une place qui attend d'être prise, voir
// globals.css pour l'animation.
interface Poste {
  x: number;
  y: number;
  rayon: number;
  capitaine?: boolean;
}

const POSTES: Poste[] = [
  { x: 100, y: 55, rayon: 22, capitaine: true },
  { x: 48, y: 30, rayon: 15 },
  { x: 48, y: 80, rayon: 15 },
  { x: 152, y: 30, rayon: 15 },
  { x: 152, y: 80, rayon: 15 },
];

export default function IllustrationEffectifVide({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 110"
      className={`h-[5.5rem] w-40 shrink-0 ${className}`}
      role="img"
      aria-label="Effectif vide"
    >
      {POSTES.map((p, i) => {
        const couleur = p.capitaine ? "var(--color-accent)" : "var(--color-muted)";
        const largeurTrait = p.capitaine ? 1.8 : 1.4;
        const opaciteCercle = p.capitaine ? 0.7 : 0.45;
        const opaciteCroix = p.capitaine ? 0.7 : 0.5;
        const m = p.rayon * 0.32;
        return (
          <g key={i} className="illustration-slot" style={{ "--i": i } as CSSProperties}>
            <circle cx={p.x} cy={p.y} r={p.rayon} fill="none" stroke={couleur} strokeWidth={largeurTrait} opacity={opaciteCercle} />
            <path
              d={`M${p.x - m} ${p.y} H${p.x + m} M${p.x} ${p.y - m} V${p.y + m}`}
              stroke={couleur}
              strokeWidth={largeurTrait}
              opacity={opaciteCroix}
            />
            {p.capitaine && (
              <circle
                cx={p.x}
                cy={p.y}
                r={p.rayon + 7}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1"
                className="illustration-capitaine-glow"
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
