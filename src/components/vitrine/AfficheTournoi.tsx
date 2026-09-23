import Image from "next/image";

// Affiche de tournoi générée (maquette Affiche-Tournoi, pages/accueil.md) :
// jamais de photo — nom du tournoi en grand, logo incliné en filigrane,
// 3 variantes de cadrage. Positions de la maquette (389 × 240) converties
// en pourcentages pour suivre la largeur de la colonne.

const VARIANTES = {
  1: { hauteur: "158%", gauche: "48.8%", haut: "-25%", rotation: "0deg", fond: "radial-gradient(circle at 80% 20%, rgba(182,255,59,.22), rgba(182,255,59,0) 55%)" },
  2: { hauteur: "192%", gauche: "-30.8%", haut: "-62.5%", rotation: "-18deg", fond: "radial-gradient(circle at 15% 30%, rgba(182,255,59,.2), rgba(182,255,59,0) 55%)" },
  3: { hauteur: "125%", gauche: "30.8%", haut: "-8.3%", rotation: "24deg", fond: "linear-gradient(120deg, rgba(182,255,59,0) 35%, rgba(182,255,59,.16) 50%, rgba(182,255,59,0) 65%)" },
} as const;

export type VarianteAffiche = keyof typeof VARIANTES;

interface AfficheTournoiProps {
  nom: string;
  format: string;
  date: string;
  variante?: VarianteAffiche;
}

export default function AfficheTournoi({ nom, format, date, variante = 1 }: AfficheTournoiProps) {
  const v = VARIANTES[variante];
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[389/240] w-full overflow-hidden rounded-carte bg-[#0B0C0B] font-texte text-text"
    >
      <div className="absolute inset-0" style={{ background: v.fond }} />
      <Image
        src="/brand/najarena-logo-blanc.svg"
        alt=""
        width={300}
        height={404}
        unoptimized
        className="pointer-events-none absolute w-auto max-w-none opacity-[0.16]"
        style={{ height: v.hauteur, left: v.gauche, top: v.haut, transform: `rotate(${v.rotation})` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(180deg,rgba(11,12,11,0),rgba(11,12,11,.92))]" />
      <div className="absolute top-5 right-[22px] left-[22px] flex items-center justify-between text-mini font-semibold">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          LOL
        </span>
        <span className="rounded-bouton border border-[rgba(245,245,244,0.3)] px-2 py-1 uppercase">{format}</span>
      </div>
      <div className="absolute right-[22px] bottom-5 left-[22px] flex flex-col gap-2">
        <span className="line-clamp-2 font-titre text-[clamp(2rem,3.1vw,2.75rem)] leading-[0.9] font-black uppercase [overflow-wrap:anywhere]">
          {nom}
        </span>
        <span className="flex justify-between text-mini text-text-2 uppercase">
          <span>{date}</span>
          <span className="text-accent">Najarena</span>
        </span>
      </div>
    </div>
  );
}
