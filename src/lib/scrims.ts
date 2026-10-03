// Scrims vérifiés entre équipes (03/10/2026, audit N22) — logique pure
// d'affichage. Les règles (dates, Bo1/Bo3, alignements, arbitre) sont
// appliquées par la base : proposer_scrim, repondre_scrim, annuler_scrim
// (docs/schema.sql, section « Scrims vérifiés entre équipes »).

/** Mêmes bornes que proposer_scrim. */
export const DELAI_MIN_SCRIM_MINUTES = 15;
export const DELAI_MAX_SCRIM_JOURS = 30;
export const BEST_OF_SCRIM = [1, 3] as const;

export type EtatScrim = "propose" | "expire" | "a_venir" | "a_jouer" | "joue" | "refuse" | "annule";

export const LIBELLE_ETAT_SCRIM: Record<EtatScrim, string> = {
  propose: "En attente de réponse",
  expire: "Proposition expirée",
  a_venir: "Programmé",
  a_jouer: "À jouer",
  joue: "Joué",
  refuse: "Refusé",
  annule: "Annulé",
};

export function etatScrim(
  d: { statut: string; prevuLe: string; statutTournoi?: string | null },
  maintenant: Date,
): EtatScrim {
  const passe = new Date(d.prevuLe).getTime() <= maintenant.getTime();
  if (d.statut === "refuse") return "refuse";
  if (d.statut === "annule" || d.statutTournoi === "annule") return "annule";
  if (d.statut === "propose") return passe ? "expire" : "propose";
  if (d.statutTournoi === "termine") return "joue";
  return passe ? "a_jouer" : "a_venir";
}

/** Résultat d'un scrim joué, du point de vue d'une équipe. */
export function resultatScrim(estGagnant: boolean | null, niveau: string | null): string {
  if (estGagnant === null || niveau === null) return "Sans résultat";
  if (niveau === "manuel") return estGagnant ? "Victoire (défaite reconnue par l'adversaire)" : "Défaite reconnue";
  return estGagnant ? "Victoire vérifiée" : "Défaite vérifiée";
}

/** Date proposée acceptable (la base refuse les autres). */
export function datePossible(prevuLe: Date, maintenant: Date): boolean {
  const ecart = prevuLe.getTime() - maintenant.getTime();
  return ecart >= DELAI_MIN_SCRIM_MINUTES * 60_000 && ecart <= DELAI_MAX_SCRIM_JOURS * 86_400_000;
}
