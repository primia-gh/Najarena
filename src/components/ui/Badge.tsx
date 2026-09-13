import type { ReactNode } from "react";

// Pastille pleine plutôt qu'un texte coloré nu — même sémantique de couleur
// que l'existant (COULEUR_NIVEAU / COULEUR_STATUT dans lib/tournois.ts),
// juste rendue plus visible. `couleur` reçoit directement une de ces
// classes text-* pour ne pas dupliquer la logique métier des niveaux.
const FOND: Record<string, string> = {
  "text-atteste": "bg-atteste/10 border-atteste/25",
  "text-laiton-texte": "bg-laiton/12 border-laiton/30",
  "text-ardoise": "bg-ardoise/10 border-ardoise/25",
  "text-sceau-texte": "bg-sceau/10 border-sceau/25",
};

interface BadgeProps {
  couleur: string;
  children: ReactNode;
  className?: string;
}

export default function Badge({ couleur, children, className = "" }: BadgeProps) {
  const fond = FOND[couleur] ?? "bg-ardoise/10 border-ardoise/25";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.08em] uppercase ${couleur} ${fond} ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
