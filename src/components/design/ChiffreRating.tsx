// Rating en très grand chiffre, dégradé blanc → vert dans la lettre
// (MASTER §6). Le chiffre reste arrondi par l'appelant (lib/classement
// arrondir) — ce composant ne fait que l'afficher.

const TAILLES = {
  carte: "text-[clamp(3.5rem,5vw,4.5rem)]", // 72 px — carte de profil (accueil)
  profil: "text-[clamp(4rem,5.8vw,5.25rem)]", // 84 px — fiche joueur
} as const;

interface ChiffreRatingProps {
  valeur: number | string;
  taille?: keyof typeof TAILLES;
  className?: string;
}

export default function ChiffreRating({ valeur, taille = "profil", className = "" }: ChiffreRatingProps) {
  return (
    <span
      className={`texte-rating block font-titre font-black leading-[0.85] tabular-nums ${TAILLES[taille]} ${className}`}
    >
      {valeur}
    </span>
  );
}
