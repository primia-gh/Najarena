"use client";

// Bouton d'envoi de formulaire de la nouvelle identité — même mécanique que
// components/ui/Bouton.tsx (useFormStatus lit le statut du <form> ancêtre,
// aucune prop à passer depuis la page), seule l'apparence change.

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";
import { classeBoutonContour, classeBoutonPrincipal, classeBoutonSecondaire, type TailleBouton } from "@/lib/design";

interface BoutonEnvoiProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "principal" | "secondaire" | "contour";
  taille?: TailleBouton;
  /** Libellé affiché pendant l'envoi — par défaut, le même texte. */
  libelleEnCours?: string;
}

export default function BoutonEnvoi({
  variante = "principal",
  taille = "normale",
  libelleEnCours,
  className = "",
  children,
  disabled,
  type = "submit",
  ...props
}: BoutonEnvoiProps) {
  const { pending } = useFormStatus();
  const classe =
    variante === "principal"
      ? classeBoutonPrincipal(taille)
      : variante === "contour"
        ? classeBoutonContour()
        : classeBoutonSecondaire();

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${classe} ${className}`}
    >
      {pending && (
        <span className="h-1.5 w-1.5 shrink-0 animate-pulsation rounded-full bg-current" aria-hidden="true" />
      )}
      {pending && libelleEnCours ? libelleEnCours : children}
    </button>
  );
}
