// Classes partagées du registre clair (polish du 12/09/2026 — "contraste et
// poids") : centralise ce qui était jusqu'ici recopié à l'identique dans
// chaque page (rounded-[3px] border border-trait bg-carte p-4...), pour que
// toutes les cartes/boutons du site changent ensemble si la direction
// artistique évolue encore.

export type AccentCarte = "sceau" | "atteste" | "ardoise" | "laiton" | "none";

const BORDURE_ACCENT: Record<AccentCarte, string> = {
  sceau: "border-l-sceau",
  atteste: "border-l-atteste",
  ardoise: "border-l-ardoise",
  laiton: "border-l-laiton",
  none: "border-l-trait",
};

/**
 * Carte standard du registre clair — liseré gauche coloré selon le statut
 * (sceau = attention/manuel, atteste = vérifié, laiton = mis en avant,
 * ardoise = neutre), ombre légère plutôt qu'une bordure uniforme partout.
 */
export function classeCarte(accent: AccentCarte = "none", interactive = false): string {
  return [
    "rounded-[3px] border border-trait border-l-[3px]",
    BORDURE_ACCENT[accent],
    "bg-carte p-4 shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]",
    interactive
      ? "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-encre/25 hover:shadow-[0_2px_4px_rgba(18,22,29,0.06),0_18px_36px_-16px_rgba(18,22,29,0.22)]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const ACCENT_DEPUIS_COULEUR: Record<string, AccentCarte> = {
  "text-atteste": "atteste",
  "text-laiton-texte": "laiton",
  "text-sceau-texte": "sceau",
  "text-ardoise": "ardoise",
};

/** Traduit une classe text-* (COULEUR_NIVEAU / COULEUR_STATUT) en accent de carte. */
export function accentDepuisCouleur(couleur: string): AccentCarte {
  return ACCENT_DEPUIS_COULEUR[couleur] ?? "none";
}

export function classeBoutonPrimaire(): string {
  // text-white plutôt que text-papier : #E7E6E1 sur #C4485C ne passe pas
  // 4.5:1 (4.07:1, vérifié le 13/09/2026) — le blanc pur si (4.74:1), et
  // la différence est visuellement imperceptible vu la proximité des
  // deux tons. Ombre recalée sur --color-sceau-lueur (registre nuit) —
  // les rgba(126,34,51,...) codés en dur dataient de l'ancien sceau clair
  // (#7E2233), jamais mis à jour lors de l'unification du 12/09/2026.
  return "inline-block rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_var(--color-sceau-lueur)] transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_20px_-6px_var(--color-sceau-lueur)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau";
}

export function classeBoutonSecondaire(): string {
  return "inline-block rounded-[3px] border border-trait bg-carte px-4 py-2 text-sm font-semibold text-encre transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-encre hover:bg-fond-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau";
}
