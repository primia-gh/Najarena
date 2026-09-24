import type { PointCourbe } from "@/lib/profil-vitrine";

// Courbe « progression du rating » du profil (maquette profil, bloc 3) :
// une variation de points = un point, dans l'ordre (le rating évolue à la
// clôture d'un tournoi, CLAUDE.md §4). Dessinée côté serveur en SVG, sans
// bibliothèque ni JavaScript. Repères horizontaux tous les 100 points.

const LARGEUR = 840;
const HAUTEUR = 270;
const MARGE_DROITE = 60; // place des libellés de repères
const MARGE_VERTICALE = 18;

export default function CourbeProgression({ points }: { points: PointCourbe[] }) {
  const valeurs = points.map((p) => p.rating);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  // Toujours au moins 100 points d'amplitude : une courbe presque plate ne
  // doit pas avoir l'air d'une montagne.
  const bas = Math.floor((Math.min(min, (min + max) / 2 - 50) - 10) / 100) * 100;
  const haut = Math.ceil((Math.max(max, (min + max) / 2 + 50) + 10) / 100) * 100;
  const largeurUtile = LARGEUR - MARGE_DROITE;

  const x = (i: number) => (points.length === 1 ? largeurUtile : (i / (points.length - 1)) * largeurUtile);
  const y = (v: number) => MARGE_VERTICALE + (1 - (v - bas) / (haut - bas)) * (HAUTEUR - 2 * MARGE_VERTICALE);

  const trace = points.map((p, i) => `${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ");
  const aire = `0,${HAUTEUR} ${trace} ${x(points.length - 1).toFixed(1)},${HAUTEUR}`;

  const reperes: number[] = [];
  for (let v = bas + 100; v < haut; v += 100) reperes.push(v);

  const dernier = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Évolution du rating sur la saison : de ${Math.round(points[0].rating)} à ${Math.round(dernier.rating)}, ${points.length - 1} variation(s).`}
    >
      <defs>
        <linearGradient id="degrade-progression" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B6FF3B" stopOpacity=".18" />
          <stop offset="1" stopColor="#B6FF3B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {reperes.map((v) => (
        <g key={v}>
          <line x1="0" y1={y(v)} x2={largeurUtile} y2={y(v)} stroke="rgba(245,245,244,.06)" strokeWidth="1" />
          <text x={largeurUtile + 10} y={y(v) + 4} fontSize="11" fill="#798079" fontFamily="var(--font-chakra-petch), sans-serif">
            {v}
          </text>
        </g>
      ))}
      <polygon points={aire} fill="url(#degrade-progression)" />
      <polyline points={trace} fill="none" stroke="#B6FF3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(dernier.rating)} r="5" fill="#B6FF3B" />
      <circle cx={x(points.length - 1)} cy={y(dernier.rating)} r="10" fill="#B6FF3B" fillOpacity=".15" />
    </svg>
  );
}
