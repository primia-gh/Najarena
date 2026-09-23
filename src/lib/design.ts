// Classes partagées de la nouvelle identité (design-system/najarena/MASTER.md
// §6) — même rôle que lib/ui.ts pour l'ancien registre, qui disparaîtra
// quand la dernière page aura été migrée. Réservées aux cas où le composant
// dédié ne convient pas (ex. un <button onClick> dans un composant client) :
// sinon, utiliser <BoutonLien> ou <BoutonEnvoi> (components/design/).

export type TailleBouton = "normale" | "grande";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

// Retours d'interaction relevés par la vérification ui-ux-pro-max du
// 23/09/2026 : curseur main (Tailwind 4 ne le met plus sur <button>) et
// léger enfoncement à l'appui — en transform, sans décaler la mise en page.
const INTERACTION = "cursor-pointer active:scale-[0.98] disabled:active:scale-100";

/** Bouton principal : fond vert, texte noir, reflet qui balaie toutes les 7 s. */
export function classeBoutonPrincipal(taille: TailleBouton = "normale"): string {
  return [
    "reflet inline-flex min-h-11 items-center justify-center gap-2 rounded-bouton bg-accent",
    taille === "grande" ? "px-10 py-[22px]" : "px-6 py-3",
    "font-texte text-bouton font-bold uppercase text-on-accent",
    "transition-[filter,transform] duration-200 hover:brightness-110",
    INTERACTION,
    FOCUS,
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100",
  ].join(" ");
}

/**
 * Bouton secondaire : lien souligné d'un filet blanc à 30 %. Soulignement
 * en text-decoration (pas en bordure) pour garder la zone cliquable à
 * 44 px de haut sans éloigner le filet du texte.
 */
export function classeBoutonSecondaire(): string {
  return [
    "inline-flex min-h-11 items-center gap-2",
    "font-texte text-bouton font-semibold uppercase text-text",
    "underline decoration-[rgba(245,245,244,0.3)] decoration-1 underline-offset-[6px]",
    "transition-[color,text-decoration-color,transform] duration-200 hover:text-accent hover:decoration-accent",
    INTERACTION,
    FOCUS,
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" ");
}
