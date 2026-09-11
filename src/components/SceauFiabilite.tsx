// Élément signature de la fiche joueur (CLAUDE.md §7) : une couronne de
// crans dont le remplissage traduit le calibrage. SVG statique calculé
// côté serveur — aucune animation, aucun JS client nécessaire.

const NOMBRE_CRANS = 48;
const RAYON_INTERIEUR = 46;
const RAYON_EXTERIEUR_ACTIF = 53;
const RAYON_EXTERIEUR_INACTIF = 50;

interface SceauFiabiliteProps {
  calibrationPct: number; // 0-100
}

export default function SceauFiabilite({ calibrationPct }: SceauFiabiliteProps) {
  const pct = Math.max(0, Math.min(100, calibrationPct));
  const fraction = pct / 100;

  const crans = Array.from({ length: NOMBRE_CRANS }, (_, i) => {
    const angle = (i / NOMBRE_CRANS) * Math.PI * 2 - Math.PI / 2;
    const actif = i < Math.round(NOMBRE_CRANS * fraction);
    const rayonExterieur = actif ? RAYON_EXTERIEUR_ACTIF : RAYON_EXTERIEUR_INACTIF;
    return {
      x1: 60 + Math.cos(angle) * RAYON_INTERIEUR,
      y1: 60 + Math.sin(angle) * RAYON_INTERIEUR,
      x2: 60 + Math.cos(angle) * rayonExterieur,
      y2: 60 + Math.sin(angle) * rayonExterieur,
      actif,
    };
  });

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Sceau de fiabilité : calibrage ${pct} %`}
      className="h-24 w-24 shrink-0"
    >
      {crans.map((c, i) => (
        <line
          key={i}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke="var(--color-sceau)"
          strokeWidth={c.actif ? 2.4 : 1}
          opacity={c.actif ? 0.85 : 0.18}
        />
      ))}
      <circle cx="60" cy="60" r="41" fill="none" stroke="var(--color-sceau)" strokeWidth="2" opacity=".78" />
      <circle cx="60" cy="60" r="35.5" fill="none" stroke="var(--color-sceau)" strokeWidth="1" opacity=".5" />
      <text
        x="60"
        y="55"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="19"
        fontWeight="700"
        fill="var(--color-sceau)"
        opacity=".85"
      >
        {pct}%
      </text>
      <text
        x="60"
        y="71"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="7.5"
        letterSpacing="1.6"
        fill="var(--color-sceau)"
        opacity=".6"
      >
        {pct >= 100 ? "CALIBRÉ" : "NON CALIBRÉ"}
      </text>
    </svg>
  );
}
