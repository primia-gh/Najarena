"use client";

import { useState } from "react";

// Copie un texte (Riot ID de l'adversaire…) dans le presse-papiers ; à
// défaut, le propose à la sélection. L'annonce « copié » est lue par les
// lecteurs d'écran.

interface BoutonCopierProps {
  texte: string;
  libelle: string;
  /** Nom accessible complet, ex. « Copier le Riot ID de Bob ». */
  libelleAccessible?: string;
  className?: string;
}

export default function BoutonCopier({ texte, libelle, libelleAccessible, className = "" }: BoutonCopierProps) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      window.prompt("Copie ce texte :", texte);
    }
  }

  return (
    <button type="button" onClick={copier} aria-label={libelleAccessible} className={className}>
      {copie ? "Copié" : libelle}
      <span className="sr-only" role="status">
        {copie ? `${texte} copié dans le presse-papiers` : ""}
      </span>
    </button>
  );
}
