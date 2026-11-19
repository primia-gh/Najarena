// Tournois par niveau (19/11/2026). Un tournoi 1v1 d'organisateur peut être
// réservé à une fourchette de paliers : bornes = seuils de paliers (CLAUDE.md
// §4, seuils fixes, mêmes valeurs que la table tiers), rating_min inclus,
// rating_max exclu. Plancher lu sur le rating de la saison ; limite haute
// sur le meilleur rating atteint dans cette saison ou la précédente
// (décisions du porteur du 19/11/2026 : redescendre exprès, même en fin de
// saison, ne rouvre pas un tournoi de niveau inférieur). Les règles sont appliquées par la base
// (controler_niveau_tournoi, controler_inscription_niveau,
// rating_niveau_meilleur) ; ici, les libellés et les choix des formulaires.

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

/** Pour l'aide des formulaires : pourquoi la limite haute lit le meilleur rating. */
export const AIDE_LIMITE_HAUTE =
  "Limite haute : on regarde le meilleur rating atteint dans cette saison ou la précédente, pas seulement le rating actuel.";

/** Seuils lisibles pour l'aide des formulaires : « Argent 1 300 · Or 1 450 · … ». */
export const SEUILS_LISIBLES = SEUILS_PALIERS.slice(1)
  .map((p) => `${p.nom} ${p.min.toLocaleString("fr-FR")}`)
  .join(" · ");

/** Choix du palier minimum : « Argent et plus » … « Champion ». */
export const CHOIX_MINIMUM = SEUILS_PALIERS.slice(1).map((p) => ({ valeur: p.min, libelle: `${p.nom} et plus` }));

/** Choix du palier maximum : « jusqu'à Bronze » … « jusqu'à Diamant » (borne = seuil du palier suivant).
 *  Dans une liste intitulée « Palier maximum », « jusqu'à » se lit bien. */
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

/** « Or et plus », « Bronze à Argent », « Argent à Or », « Or » ; nul sans niveau. */
export function libelleNiveau(min: number | null, max: number | null): string | null {
  const bas = min !== null ? palierDuSeuil(min) : null;
  const haut = max !== null ? palierSousLeSeuil(max) : null;
  if (bas && haut) return bas === haut ? bas : `${bas} à ${haut}`;
  if (bas) return `${bas} et plus`;
  // Sans minimum, la fourchette part du premier palier : « Bronze à Argent »
  // se lit mieux que « jusqu'à Argent » dans une phrase.
  if (haut) return haut === SEUILS_PALIERS[0].nom ? haut : `${SEUILS_PALIERS[0].nom} à ${haut}`;
  return null;
}

/** Palier d'un rating (seuils fixes, CLAUDE.md §4). */
export function palierDuRating(rating: number): string {
  let nom = SEUILS_PALIERS[0].nom;
  for (const p of SEUILS_PALIERS) if (rating >= p.min) nom = p.nom;
  return nom;
}

/** « 1 380 » : rating arrondi, espace fine insécable des milliers. */
function formaterRatingNiveau(rating: number): string {
  return Math.round(rating).toLocaleString("fr-FR");
}

/**
 * Pourquoi un joueur n'entre pas dans un tournoi par niveau, avec son
 * rating : « Ton rating de la saison : 1 380 (Argent). Ce tournoi est
 * réservé aux joueurs de niveau Or et plus : il te manque 70 points. »
 * `meilleur` : meilleur rating atteint dans cette saison ou la précédente (limite haute).
 */
export function situationNiveau(
  rating: number | null,
  min: number | null,
  max: number | null,
  meilleur: number | null = null,
): string {
  const niveau = libelleNiveau(min, max);
  const r = rating ?? RATING_DEPART;
  const m = Math.max(r, meilleur ?? r);
  const tonRating =
    rating === null
      ? `Tu n'as pas encore joué cette saison : ton rating compte pour ${formaterRatingNiveau(r)} (${palierDuRating(r)}).`
      : `Ton rating de la saison : ${formaterRatingNiveau(r)} (${palierDuRating(r)}).`;
  const reserve = niveau ? `Ce tournoi est réservé aux joueurs de niveau ${niveau}` : "Ce tournoi est réservé à un niveau";
  if (min !== null && r < min) {
    return `${tonRating} ${reserve} : il te manque ${formaterRatingNiveau(min - r)} points.`;
  }
  if (max !== null && r >= max) {
    return `${tonRating} ${reserve} : ton niveau le dépasse, c'est un tournoi pour des joueurs moins avancés.`;
  }
  if (max !== null && m >= max) {
    return `${tonRating} ${reserve}. Ton rating actuel convient, mais pour la limite haute, c'est ton meilleur rating de cette saison ou de la précédente qui compte : ${formaterRatingNiveau(m)} (${palierDuRating(m)}), au-dessus.`;
  }
  return `${tonRating} ${reserve}.`;
}

/**
 * Le joueur entre-t-il dans la fourchette ? Plancher : rating de la saison
 * (1500 sans partie). Limite haute : meilleur rating atteint dans la saison.
 */
export function ratingDansNiveau(
  rating: number | null,
  min: number | null,
  max: number | null,
  meilleur: number | null = null,
): boolean {
  const r = rating ?? RATING_DEPART;
  const m = Math.max(r, meilleur ?? r);
  return (min === null || r >= min) && (max === null || m < max);
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
    "Ton niveau n'est pas celui de ce tournoi : on regarde ton rating de la saison (1500 si tu n'as pas encore joué) et, pour la limite haute, ton meilleur rating de cette saison ou de la précédente.",
};

/** Check-in refusé (site et bouton Discord) : le niveau a changé depuis l'inscription. */
export const MESSAGE_NIVEAU_CHECKIN =
  "Ton niveau n'est plus celui de ce tournoi (rating de la saison et, pour la limite haute, meilleur rating de cette saison ou de la précédente) : tu ne peux pas confirmer ta présence.";

/** Confirmation par l'organisateur refusée pour la même raison. */
export const MESSAGE_NIVEAU_ORGANISATEUR =
  "Le niveau de ce joueur n'est plus celui du tournoi (rating de la saison et, pour la limite haute, meilleur rating de cette saison ou de la précédente) : sa présence ne peut pas être confirmée.";

/** Message d'un refus de la base lié au niveau, sinon nul. */
export function messageNiveau(erreur: string | undefined | null): string | null {
  if (!erreur) return null;
  const code = Object.keys(MESSAGES_NIVEAU).find((c) => erreur.includes(c));
  return code ? MESSAGES_NIVEAU[code] : null;
}
