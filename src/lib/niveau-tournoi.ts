// Tournois par niveau (19/11/2026). Un tournoi 1v1 d'organisateur peut être
// réservé à une fourchette de paliers : bornes = seuils de paliers (CLAUDE.md
// §4, seuils fixes, mêmes valeurs que la table tiers), rating_min inclus,
// rating_max exclu. Les règles sont appliquées par la base
// (controler_niveau_tournoi, controler_inscription_niveau) ; ici, les
// libellés et les choix des formulaires.

export const RATING_DEPART = 1500;

/** Paliers et leur seuil, du plus bas au plus haut. */
export const SEUILS_PALIERS: { nom: string; min: number }[] = [
  { nom: "Bronze", min: 0 },
  { nom: "Argent", min: 1300 },
  { nom: "Or", min: 1450 },
  { nom: "Platine", min: 1600 },
  { nom: "Diamant", min: 1750 },
  { nom: "Champion", min: 1900 },
];

/** Choix du palier minimum : « Argent et plus » … « Champion ». */
export const CHOIX_MINIMUM = SEUILS_PALIERS.slice(1).map((p) => ({ valeur: p.min, libelle: `${p.nom} et plus` }));

/** Choix du palier maximum : « jusqu'à Bronze » … « jusqu'à Diamant » (borne = seuil du palier suivant). */
export const CHOIX_MAXIMUM = SEUILS_PALIERS.slice(0, -1).map((p, i) => ({
  valeur: SEUILS_PALIERS[i + 1].min,
  libelle: `jusqu'à ${p.nom}`,
}));

function palierDuSeuil(min: number): string | null {
  return SEUILS_PALIERS.find((p) => p.min === min)?.nom ?? null;
}

function palierSousLeSeuil(max: number): string | null {
  const i = SEUILS_PALIERS.findIndex((p) => p.min === max);
  return i > 0 ? SEUILS_PALIERS[i - 1].nom : null;
}

/** « Or et plus », « jusqu'à Argent », « Argent à Or », « Or » ; nul sans niveau. */
export function libelleNiveau(min: number | null, max: number | null): string | null {
  const bas = min !== null ? palierDuSeuil(min) : null;
  const haut = max !== null ? palierSousLeSeuil(max) : null;
  if (bas && haut) return bas === haut ? bas : `${bas} à ${haut}`;
  if (bas) return `${bas} et plus`;
  if (haut) return `jusqu'à ${haut}`;
  return null;
}

/** Le rating (saison en cours, 1500 sans partie) entre-t-il dans la fourchette ? */
export function ratingDansNiveau(rating: number | null, min: number | null, max: number | null): boolean {
  const r = rating ?? RATING_DEPART;
  return (min === null || r >= min) && (max === null || r < max);
}

export type LectureNiveau = { ok: true; min: number | null; max: number | null } | { ok: false; erreur: string };

/** Lit les deux listes du formulaire (« niveau_min », « niveau_max »), vides = ouvert à tous. */
export function lireNiveau(minBrut: unknown, maxBrut: unknown, format: string): LectureNiveau {
  const lire = (v: unknown, choix: { valeur: number }[]): number | null | undefined => {
    const texte = typeof v === "string" ? v.trim() : "";
    if (texte === "") return null;
    const n = Number(texte);
    return choix.some((c) => c.valeur === n) ? n : undefined;
  };
  const min = lire(minBrut, CHOIX_MINIMUM);
  const max = lire(maxBrut, CHOIX_MAXIMUM);
  if (min === undefined || max === undefined) return { ok: false, erreur: MESSAGES_NIVEAU.NIVEAU_INVALIDE };
  if (min !== null && max !== null && min >= max) return { ok: false, erreur: MESSAGES_NIVEAU.NIVEAU_INVALIDE };
  if ((min !== null || max !== null) && format !== "1v1") {
    return { ok: false, erreur: MESSAGES_NIVEAU.NIVEAU_1V1_SEULEMENT };
  }
  return { ok: true, min, max };
}

export const MESSAGES_NIVEAU: Record<string, string> = {
  NIVEAU_INVALIDE: "Niveau incohérent : le palier minimum doit être en dessous du palier maximum.",
  NIVEAU_1V1_SEULEMENT: "Un niveau ne se choisit que pour un tournoi 1v1.",
  NIVEAU_HORS_TOURNOI:
    "Ton rating de la saison n'est pas dans le niveau de ce tournoi (1500 si tu n'as pas encore joué).",
};

/** Message d'un refus de la base lié au niveau, sinon nul. */
export function messageNiveau(erreur: string | undefined | null): string | null {
  if (!erreur) return null;
  const code = Object.keys(MESSAGES_NIVEAU).find((c) => erreur.includes(c));
  return code ? MESSAGES_NIVEAU[code] : null;
}
