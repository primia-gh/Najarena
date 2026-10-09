// Météo du classement (09/10/2026, idée en réserve n°5) : à quel point le
// classement est déjà précis. Chiffres calculés par la base
// (meteo_classement, meteo_semaines) ; ce fichier les met en mots, sans rien
// enjoliver. Logique pure, testée dans meteo.test.ts.

import { RD_SEUIL_CLASSEMENT } from "@/lib/classement";

export interface DonneesMeteo {
  saison: string | null;
  joueurs_avec_rating: number;
  joueurs_classes: number;
  rd_median: number | null;
  joueurs_actifs_30j: number;
  matchs_30j: number;
  matchs_verifies_30j: number;
  matchs_par_actif_median: number | null;
}

export type EtatMeteo = "solide" | "en_construction" | "jeune" | "sans_donnees";

/**
 * L'état du classement, d'après l'incertitude médiane des joueurs notés :
 * sous le seuil d'entrée au classement (RD 150), la moitié des joueurs au
 * moins ont un niveau sûr. Règle publique, affichée telle quelle.
 */
export function etatMeteo(d: DonneesMeteo): EtatMeteo {
  if (d.joueurs_avec_rating === 0 || d.rd_median === null) return "sans_donnees";
  if (d.rd_median <= RD_SEUIL_CLASSEMENT) return "solide";
  if (d.rd_median <= 250) return "en_construction";
  return "jeune";
}

export const LIBELLE_ETAT: Record<EtatMeteo, { titre: string; texte: string }> = {
  solide: {
    titre: "Solide",
    texte: "Plus de la moitié des joueurs notés ont assez joué pour un niveau sûr.",
  },
  en_construction: {
    titre: "En construction",
    texte: "Les niveaux se précisent : la plupart des joueurs n'ont pas encore joué assez de matchs vérifiés.",
  },
  jeune: {
    titre: "Encore jeune",
    texte: "Peu de matchs par joueur pour l'instant : les ratings bougeront encore beaucoup.",
  },
  sans_donnees: {
    titre: "Pas encore de données",
    texte: "Aucun joueur noté cette saison pour l'instant.",
  },
};

/** Part des résultats lus chez Riot, en % entier ; null sans match. */
export function partVerifiee(matchs: number, verifies: number): number | null {
  return matchs > 0 ? Math.round((verifies / matchs) * 100) : null;
}

/** « 4,5 » — un chiffre après la virgule, à la française. */
export function formaterDecimal(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}
