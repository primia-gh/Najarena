"use client";

import { useState } from "react";

// « Partager le CV » du profil (maquette profil) : partage le lien public
// du profil — qui EST le CV e-sport (CLAUDE.md §8). Feuille de partage du
// téléphone quand elle existe, sinon copie du lien. L'export imprimable
// (/joueur/[pseudo]/cv) reste un bouton à part, réservé à l'offre Elite.

interface BoutonPartagerProps {
  chemin: string;
  titre: string;
  libelle: string;
  className?: string;
}

export default function BoutonPartager({ chemin, titre, libelle, className = "" }: BoutonPartagerProps) {
  const [copie, setCopie] = useState(false);

  async function partager() {
    const url = `${window.location.origin}${chemin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: titre, url });
        return;
      } catch {
        // Partage annulé par l'utilisateur : on ne fait rien de plus.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      window.prompt("Copie ce lien :", url);
    }
  }

  return (
    <button type="button" onClick={partager} className={className}>
      {copie ? "Lien copié" : libelle}
      <span className="sr-only" role="status">
        {copie ? "Lien du profil copié dans le presse-papiers" : ""}
      </span>
    </button>
  );
}
