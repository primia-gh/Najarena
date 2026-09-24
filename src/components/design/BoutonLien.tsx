import Link from "next/link";
import type { ReactNode } from "react";
import { classeBoutonContour, classeBoutonPrincipal, classeBoutonSecondaire, type TailleBouton } from "@/lib/design";

// Lien habillé en bouton (navigation) — MASTER §6. Pour un bouton qui
// envoie un formulaire, utiliser <BoutonEnvoi> (état « en cours » inclus).

interface BoutonLienProps {
  href: string;
  variante?: "principal" | "secondaire" | "contour";
  taille?: TailleBouton;
  /** Flèche « → » après le texte — par défaut sur le bouton secondaire. */
  fleche?: boolean;
  className?: string;
  children: ReactNode;
}

export default function BoutonLien({
  href,
  variante = "principal",
  taille = "normale",
  fleche = variante === "secondaire",
  className = "",
  children,
}: BoutonLienProps) {
  const classe =
    variante === "principal"
      ? classeBoutonPrincipal(taille)
      : variante === "contour"
        ? classeBoutonContour()
        : classeBoutonSecondaire();
  return (
    <Link href={href} className={`${classe} ${className}`}>
      {children}
      {fleche && <span aria-hidden="true">→</span>}
    </Link>
  );
}
