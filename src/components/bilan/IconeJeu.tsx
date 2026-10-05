import type { ElementJeu } from "@/lib/ddragon";

// Icône d'un champion, d'un objet, d'une rune ou d'un sort, servie par
// Data Dragon (Riot) — seulement dans l'analyse du joueur (CLAUDE.md §7).
// Sans icône, une pastille et le nom au survol, jamais une case vide : les
// initiales d'un champion (son nom est connu), « ? » pour un objet, une
// rune ou un sort introuvable (Data Dragon injoignable, retiré du jeu).

interface IconeJeuProps {
  element: ElementJeu;
  taille?: number;
  /** L'icône est à côté de son nom écrit : rien de plus à lire pour un lecteur d'écran. */
  decorative?: boolean;
  rond?: boolean;
}

function initiales(nom: string): string {
  return nom
    .split(/[\s'’-]+/)
    .filter((mot) => /^\p{L}/u.test(mot))
    .slice(0, 2)
    .map((mot) => mot[0])
    .join("")
    .toUpperCase();
}

export default function IconeJeu({ element, taille = 32, decorative = false, rond = false }: IconeJeuProps) {
  const forme = rond ? "rounded-full" : "rounded-carte";
  if (!element.image) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center border border-line bg-surface font-titre text-[11px] font-bold text-muted ${forme}`}
        style={{ width: taille, height: taille }}
        title={element.nom}
        {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": element.nom })}
      >
        {(!element.inconnu && initiales(element.nom)) || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- icône servie telle quelle par Data Dragon, sans passer par l'optimiseur d'images
    <img
      src={element.image}
      alt={decorative ? "" : element.nom}
      title={element.nom}
      width={taille}
      height={taille}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`shrink-0 border border-line bg-surface ${forme}`}
    />
  );
}
