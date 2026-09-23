import Image from "next/image";
import Panneau from "@/components/design/Panneau";

// Visuels des deux portes « Équipes » / « Recruteurs » de l'accueil. La
// maquette prévoit deux photos (« [Photo : une équipe en pleine partie] ») :
// aucune n'est fournie et MASTER §9 interdit tout écran de jeu
// identifiable — remplacées par des schémas d'interface codés, dans l'esprit
// des boucles « comment ça marche ». Décoratifs : le texte à côté porte le sens.

const ROLES = [
  { role: "TOP", avatar: "/avatars/avatar-02.svg" },
  { role: "JGL", avatar: "/avatars/avatar-03.svg" },
  { role: "MID", avatar: "/avatars/avatar-01.svg" },
  { role: "ADC", avatar: "/avatars/avatar-05.svg" },
];

/** Roster de 5 places, dont une à pourvoir. */
export function IllustrationEquipe() {
  return (
    <Panneau
      reperes
      className="flex h-[clamp(260px,29vw,420px)] items-center justify-center overflow-hidden px-6"
    >
      <div aria-hidden="true" className="flex w-full max-w-[460px] flex-col gap-5">
        <span className="text-mini text-muted uppercase">Roster · 4 / 5</span>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {ROLES.map((r) => (
            <div key={r.role} className="flex flex-col items-center gap-2">
              <Image src={r.avatar} alt="" width={64} height={64} unoptimized className="h-auto w-full rounded-avatar" />
              <span className="text-[10px] tracking-[2px] text-muted">{r.role}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <span className="flex aspect-square w-full animate-pulsation items-center justify-center rounded-avatar border border-dashed border-accent font-titre text-2xl font-black text-accent">
              ?
            </span>
            <span className="text-[10px] tracking-[2px] text-accent">SUP</span>
          </div>
        </div>
        <span className="self-start rounded-bouton bg-accent px-2.5 py-[5px] text-mini font-semibold text-on-accent uppercase">
          Support recherché
        </span>
      </div>
    </Panneau>
  );
}

const RESULTATS = [
  { avatar: "/avatars/avatar-04.svg", rating: 1912, largeur: "92%" },
  { avatar: "/avatars/avatar-02.svg", rating: 1874, largeur: "84%" },
  { avatar: "/avatars/avatar-03.svg", rating: 1805, largeur: "74%" },
];

/** Recherche filtrée par niveau et résultats classés. */
export function IllustrationRecherche() {
  return (
    <Panneau
      reperes
      className="flex h-[clamp(260px,29vw,420px)] items-center justify-center overflow-hidden px-6"
    >
      <div aria-hidden="true" className="flex w-full max-w-[460px] flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {["Rating ≥ 1800", "Classé", "Mid"].map((f) => (
            <span
              key={f}
              className="rounded-bouton border border-line-strong px-2.5 py-1 text-mini whitespace-nowrap text-text-2 uppercase"
            >
              {f}
            </span>
          ))}
        </div>
        <ul className="flex flex-col">
          {RESULTATS.map((r) => (
            <li key={r.rating} className="flex items-center gap-3 border-b border-[rgba(245,245,244,0.06)] py-3 last:border-b-0">
              <Image src={r.avatar} alt="" width={34} height={34} unoptimized className="rounded-avatar" />
              <span className="h-0.5 flex-1 bg-[rgba(245,245,244,0.1)]">
                <span className="block h-0.5 bg-accent" style={{ width: r.largeur }} />
              </span>
              <span className="w-12 text-right text-sm font-semibold tabular-nums">{r.rating}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panneau>
  );
}
