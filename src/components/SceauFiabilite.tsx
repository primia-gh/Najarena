// Élément signature de la fiche joueur (CLAUDE.md §7) : une couronne de
// crans dont le remplissage traduit le calibrage. SVG statique calculé
// côté serveur — aucune animation, aucun JS client nécessaire.

const NOMBRE_CRANS = 48;
const RAYON_INTERIEUR = 46;
const RAYON_EXTERIEUR_ACTIF = 53;
const RAYON_EXTERIEUR_INACTIF = 50;

interface SceauFiabiliteProps {
  calibrationPct: number; // 0-100
  couleur?: string; // par défaut var(--color-sceau) — surchargée en registre nuit
}

export default function SceauFiabilite({ calibrationPct, couleur = "var(--color-sceau)" }: SceauFiabiliteProps) {
  const pct = Math.max(0, Math.min(100, calibrationPct));
  const fraction = pct / 100;

  // Arrondi à 3 décimales : Math.cos/sin peuvent différer d'un dernier bit
  // entre le moteur JS serveur et celui du navigateur pour un même angle,
  // ce qui suffit à déclencher un avertissement d'hydratation sur les
  // attributs SVG une fois ce composant rendu dans un arbre client (voir
  // SceauVitrine.tsx) — sans aucun effet visuel à cette échelle.
  const arrondi = (n: number) => Math.round(n * 1000) / 1000;

  const crans = Array.from({ length: NOMBRE_CRANS }, (_, i) => {
    const angle = (i / NOMBRE_CRANS) * Math.PI * 2 - Math.PI / 2;
    const actif = i < Math.round(NOMBRE_CRANS * fraction);
    const rayonExterieur = actif ? RAYON_EXTERIEUR_ACTIF : RAYON_EXTERIEUR_INACTIF;
    return {
      x1: arrondi(60 + Math.cos(angle) * RAYON_INTERIEUR),
      y1: arrondi(60 + Math.sin(angle) * RAYON_INTERIEUR),
      x2: arrondi(60 + Math.cos(angle) * rayonExterieur),
      y2: arrondi(60 + Math.sin(angle) * rayonExterieur),
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
          stroke={couleur}
          strokeWidth={c.actif ? 2.4 : 1}
          opacity={c.actif ? 0.85 : 0.18}
        />
      ))}
      <circle cx="60" cy="60" r="41" fill="none" stroke={couleur} strokeWidth="2" opacity=".78" />
      <circle cx="60" cy="60" r="35.5" fill="none" stroke={couleur} strokeWidth="1" opacity=".5" />
      <text
        x="60"
        y="55"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="19"
        fontWeight="700"
        fill={couleur}
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
        fill={couleur}
        opacity=".6"
      >
        {pct >= 100 ? "CALIBRÉ" : "NON CALIBRÉ"}
      </text>
    </svg>
  );
}
