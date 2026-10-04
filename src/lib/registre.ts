// Registre des points scellé (28/09/2026, audit N8) : chaque ligne du
// journal des points porte l'empreinte de la précédente (docs/schema.sql,
// « Registre des points scellé »). La vérification indépendante est
// scripts/verifier-registre.mjs ; ici, ce que le site en affiche.

/** Heure de Paris à partir de laquelle l'empreinte du jour part sur Discord. */
export const HEURE_PUBLICATION_EMPREINTE = "23:45";

/**
 * L'empreinte du jour est publiée une fois par jour, en fin de soirée, et
 * seulement si le registre a changé depuis la dernière publication (pas
 * de message les jours sans tournoi).
 */
export function doitPublierEmpreinte(
  heureParis: string,
  dejaPublieeAujourdhui: boolean,
  numeroCourant: number | null,
  numeroDernierePublication: number | null,
): boolean {
  if (heureParis < HEURE_PUBLICATION_EMPREINTE || dejaPublieeAujourdhui) return false;
  if (numeroCourant === null) return false;
  return numeroDernierePublication === null || numeroCourant > numeroDernierePublication;
}

/** Empreinte raccourcie pour l'affichage : « 22facb62a245…68b3f ». */
export function empreinteCourte(empreinte: string): string {
  return empreinte.length > 20 ? `${empreinte.slice(0, 12)}…${empreinte.slice(-5)}` : empreinte;
}

export const LABEL_MOTIF_REGISTRE: Record<string, string> = {
  tournoi: "Clôture de tournoi",
  soft_reset: "Nouvelle saison",
  inactivite: "Inactivité",
  correction: "Correction",
};
