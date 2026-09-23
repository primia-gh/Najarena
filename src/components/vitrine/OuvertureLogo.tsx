import { CHEMIN_LOGO, VIEWBOX_LOGO } from "@/lib/logo-chemin";
import styles from "./vitrine.module.css";

// Animation d'ouverture de l'accueil (MASTER §7, maquette Ouverture-Anim) :
// le contour du logo se dessine en vert (~4 s), éclair, remplissage
// discret, halo qui respire, braises qui montent. Pur CSS — aucun JS, rien
// à hydrater. Décoratif : masqué des lecteurs d'écran.
// Toutes les positions sont celles de la maquette (1440 × 860), exprimées
// en pourcentages du cadre pour suivre la taille réelle de l'écran.

// Braises de la maquette : position (px sur 1440 × 860), taille, délai, durée.
const BRAISES = [
  { x: 971, y: 497, t: 4, d: 6.9, v: 5.3 },
  { x: 1188, y: 468, t: 3, d: 6.5, v: 8.6 },
  { x: 859, y: 439, t: 2, d: 5.6, v: 5.3 },
  { x: 732, y: 702, t: 4, d: 3.4, v: 7.3 },
  { x: 868, y: 742, t: 2, d: 6.5, v: 6.6 },
  { x: 866, y: 443, t: 3, d: 4.7, v: 5.6 },
  { x: 760, y: 712, t: 3, d: 6.4, v: 7.7 },
  { x: 745, y: 717, t: 3, d: 5.2, v: 7.2 },
  { x: 704, y: 708, t: 2, d: 6.7, v: 7 },
  { x: 1184, y: 638, t: 3, d: 5.8, v: 8.7 },
  { x: 1010, y: 573, t: 3, d: 7.8, v: 7.8 },
  { x: 889, y: 461, t: 3, d: 6.2, v: 8.5 },
  { x: 1386, y: 649, t: 3, d: 6.7, v: 5.3 },
  { x: 1164, y: 634, t: 3, d: 7.5, v: 5.6 },
  { x: 1140, y: 635, t: 2, d: 8.8, v: 5.3 },
  { x: 1211, y: 713, t: 3, d: 5, v: 6.4 },
];

const pctX = (px: number) => `${((px / 1440) * 100).toFixed(2)}%`;
const pctY = (px: number) => `${((px / 860) * 100).toFixed(2)}%`;

export default function OuvertureLogo({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute overflow-hidden ${className}`}>
      <div className={`absolute inset-0 ${styles.ouvertureEcailles}`} />
      <div
        className={`absolute aspect-square rounded-full ${styles.ouvertureHalo}`}
        style={{ left: pctX(600), top: pctY(-120), width: pctX(900) }}
      />
      <div
        className={`absolute aspect-square rounded-full ${styles.ouvertureEclair}`}
        style={{ left: pctX(690), top: pctY(-10), width: pctX(700) }}
      />
      <svg
        viewBox={VIEWBOX_LOGO}
        className="absolute overflow-visible"
        style={{ left: pctX(700), top: pctY(-20), height: pctY(900) }}
      >
        <path
          className={styles.ouvertureRemplissage}
          d={CHEMIN_LOGO}
          fill="#F5F5F4"
          fillOpacity={0.07}
          fillRule="evenodd"
          stroke="none"
        />
        <path
          className={styles.ouvertureTrait}
          d={CHEMIN_LOGO}
          pathLength={1}
          fill="none"
          stroke="#B6FF3B"
          strokeOpacity={0.3}
          strokeWidth={3}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {BRAISES.map((b, i) => (
        <span
          key={i}
          className={`absolute ${styles.braise}`}
          style={{
            left: pctX(b.x),
            top: pctY(b.y),
            width: b.t,
            height: b.t,
            animationDelay: `${b.d}s`,
            animationDuration: `${b.v}s`,
          }}
        />
      ))}
    </div>
  );
}
