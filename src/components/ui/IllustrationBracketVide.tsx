import type { CSSProperties } from "react";

// Illustration décorative d'état vide — un bracket à 8 places, encore
// vide (aucun tournoi, aucune inscription, aucun résultat). La finale
// est mise en valeur en laiton (couleur palmarès) ; un signal continue
// de parcourir les deux branches vers elle, comme un tournoi qui attend
// ses premiers résultats — voir globals.css pour l'animation.
const NOEUDS_TOUR_1 = [16, 46, 76, 106].map((y) => ({ x: 14, y }));
const CHEMINS_TOUR_1 = ["M18 16 H60 V31", "M18 46 H60 V31", "M18 76 H60 V91", "M18 106 H60 V91"];
const NOEUDS_TOUR_2 = [
  { x: 64, y: 31 },
  { x: 64, y: 91 },
];
const CHEMINS_TOUR_2 = ["M68 31 H140 V61", "M68 91 H140 V61"];

export default function IllustrationBracketVide({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 140"
      className={`h-[7rem] w-40 shrink-0 ${className}`}
      role="img"
      aria-label="Bracket vide"
    >
      <g fill="none" stroke="var(--color-muted)" strokeWidth="1.5" opacity=".5">
        {NOEUDS_TOUR_1.map((n, i) => (
          <circle
            key={`n1-${i}`}
            cx={n.x}
            cy={n.y}
            r="4.5"
            className="illustration-slot"
            style={{ "--i": i } as CSSProperties}
          />
        ))}
        {CHEMINS_TOUR_1.map((d, i) => (
          <path key={`c1-${i}`} d={d} className="illustration-slot" style={{ "--i": i + 1 } as CSSProperties} />
        ))}
        {NOEUDS_TOUR_2.map((n, i) => (
          <circle
            key={`n2-${i}`}
            cx={n.x}
            cy={n.y}
            r="4.5"
            className="illustration-slot"
            style={{ "--i": i + 4 } as CSSProperties}
          />
        ))}
        {CHEMINS_TOUR_2.map((d, i) => (
          <path key={`c2-${i}`} d={d} className="illustration-slot" style={{ "--i": i + 6 } as CSSProperties} />
        ))}
      </g>

      <circle
        cx="144"
        cy="61"
        r="6"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        opacity=".8"
        className="illustration-slot"
        style={{ "--i": 8 } as CSSProperties}
      />
      <circle
        cx="144"
        cy="61"
        r="11"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1"
        opacity=".3"
        className="illustration-slot"
        style={{ "--i": 9 } as CSSProperties}
      />

      {CHEMINS_TOUR_2.map((d, i) => (
        <path
          key={`pulse-${i}`}
          d={d}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.8"
          strokeDasharray="3 21"
          className="illustration-pulse-spine"
          style={{ animationDelay: `${i * 1.3}s` }}
        />
      ))}
    </svg>
  );
}
