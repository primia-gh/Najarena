"use client";

// Bouton de formulaire avec état "en cours" automatique — useFormStatus
// lit le statut du <form> ancêtre, aucune prop à passer depuis la page.
// Réutilise les mêmes classes que classeBoutonPrimaire/Secondaire
// (lib/ui.ts) pour qu'un <Bouton> et un <Link className={classeBoutonPrimaire()}>
// restent visuellement identiques.

import { useFormStatus } from "react-dom";
import { useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes } from "react";
import { classeBoutonPrimaire, classeBoutonSecondaire } from "@/lib/ui";

type Variante = "primaire" | "secondaire";

interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** Libellé affiché pendant l'envoi — par défaut, le même texte. */
  libelleEnCours?: string;
}

export default function Bouton({
  variante = "primaire",
  libelleEnCours,
  className = "",
  children,
  disabled,
  type = "submit",
  ...props
}: BoutonProps) {
  const { pending } = useFormStatus();
  const reduitMotion = useReducedMotion();
  const classeBase = variante === "primaire" ? classeBoutonPrimaire() : classeBoutonSecondaire();

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${classeBase} inline-flex items-center gap-2 ${className}`}
    >
      {pending && !reduitMotion && (
        <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
        </svg>
      )}
      {pending && libelleEnCours ? libelleEnCours : children}
    </button>
  );
}
