"use client";

// Enveloppe un bouton de soumission dans une confirmation navigateur avant
// de laisser partir l'action — pour les actions difficiles à annuler
// (retirer un membre, quitter une équipe). N'importe quelle prop d'un
// <button> normal passe telle quelle ; seul le clic est intercepté.

import type { ButtonHTMLAttributes } from "react";

interface BoutonConfirmationProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  confirmation: string;
}

export default function BoutonConfirmation({
  confirmation,
  onClick,
  ...props
}: BoutonConfirmationProps) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmation)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
