// Pastille V / D (MASTER §6) : la lettre porte le sens, la couleur ne fait
// que le renforcer — jamais la couleur seule (daltonisme).

interface PastilleResultatProps {
  resultat: "V" | "D";
  className?: string;
}

export default function PastilleResultat({ resultat, className = "" }: PastilleResultatProps) {
  const victoire = resultat === "V";
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-bouton font-texte text-[13px] font-bold ${
        victoire ? "bg-accent/14 text-accent" : "bg-danger/12 text-danger"
      } ${className}`}
    >
      <span aria-hidden="true">{resultat}</span>
      <span className="sr-only">{victoire ? "Victoire" : "Défaite"}</span>
    </span>
  );
}
