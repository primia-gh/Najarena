import type { ReactNode } from "react";

// Pastille de statut — même mode d'emploi qu'avant (la page passe une des
// classes text-* de COULEUR_NIVEAU / COULEUR_STATUT, lib/tournois.ts), mise
// au style « Venin » le 24/09/2026 : coin de 2 px, MAJUSCULES espacées
// (MASTER §6). Vert = vérifié / ouvert / en cours ; gris = manuel /
// terminé ; rouge = erreur. Un point de couleur + le texte : jamais la
// couleur seule.
const FOND: Record<string, string> = {
  "text-accent": "bg-accent/10 border-accent/30",
  "text-muted": "bg-muted/10 border-line-strong",
  "text-danger": "bg-danger/10 border-danger/30",
};

interface BadgeProps {
  couleur: string;
  children: ReactNode;
  className?: string;
}

export default function Badge({ couleur, children, className = "" }: BadgeProps) {
  const fond = FOND[couleur] ?? "bg-muted/10 border-line-strong";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-bouton border px-2 py-1 font-texte text-mini font-semibold whitespace-nowrap uppercase ${couleur} ${fond} ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
