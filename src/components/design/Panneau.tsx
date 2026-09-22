import type { ElementType, ReactNode } from "react";
import ReperesVisee from "@/components/design/ReperesVisee";

// Panneau (MASTER §5) : dégradé #131513 → #0D0F0D, bordure fine, reflet
// en haut. À réserver aux vrais blocs — MASTER préfère les séparateurs aux
// boîtes, un panneau par idée, pas un cadre autour de tout.

interface PanneauProps {
  as?: ElementType;
  /** Repères de visée aux 4 coins — pour les visuels, pas les blocs de texte. */
  reperes?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Panneau({ as: Balise = "div", reperes = false, className = "", children }: PanneauProps) {
  return (
    <Balise className={`panneau ${reperes ? "relative" : ""} ${className}`}>
      {reperes && <ReperesVisee />}
      {children}
    </Balise>
  );
}
