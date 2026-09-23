import Image from "next/image";

// Avatar d'un joueur (MASTER §5 et §8). profiles.avatar_url n'est rempli par
// aucun écran à ce jour (choix d'avatar = palier suivant, MASTER §8) : on
// affiche alors l'initiale du pseudo sur un carré neutre, plutôt que
// d'attribuer d'office un avatar que le joueur n'a pas choisi.

interface AvatarJoueurProps {
  pseudo: string;
  src?: string | null;
  taille?: number;
  className?: string;
}

export default function AvatarJoueur({ pseudo, src, taille = 34, className = "" }: AvatarJoueurProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={taille}
        height={taille}
        unoptimized
        className={`shrink-0 rounded-avatar ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-avatar border border-line bg-surface font-titre font-extrabold text-muted uppercase ${className}`}
      style={{ width: taille, height: taille, fontSize: Math.round(taille * 0.5) }}
    >
      {pseudo.charAt(0)}
    </span>
  );
}
