import Image from "next/image";

// Logo cobra + nom (MASTER §1). Toujours blanc sur fond sombre, jamais
// recoloré en vert. Fichier provisoire : sera remplacé par celui de
// l'artiste sous le même nom (public/brand/najarena-logo-blanc.svg).

interface LogoProps {
  /** Hauteur du cobra en px — le nom suit proportionnellement. */
  hauteur?: number;
  avecNom?: boolean;
  className?: string;
}

// viewBox du SVG : 1203 × 1621.
const RATIO = 1203 / 1621;

export default function Logo({ hauteur = 44, avecNom = true, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3.5 ${className}`}>
      <Image
        src="/brand/najarena-logo-blanc.svg"
        alt={avecNom ? "" : "Najarena"}
        width={Math.round(hauteur * RATIO)}
        height={hauteur}
        unoptimized
        loading="eager"
      />
      {avecNom && (
        <span
          className="font-titre font-extrabold tracking-[4px] text-text"
          style={{ fontSize: `${Math.round(hauteur * 0.6)}px` }}
        >
          NAJARENA
        </span>
      )}
    </span>
  );
}
