// Signaux à examiner (28/09/2026, audit N11) : repérer les schémas qui
// peuvent trahir une entente pour gonfler un classement. Ce sont des
// signaux, jamais des preuves : l'administrateur regarde, puis décide
// (rien n'est fait automatiquement). Logique pure, testée dans
// signaux.test.ts ; affichée dans /admin.

export interface MatchSignal {
  tournoiId: string;
  /** Deux joueurs, avec qui a gagné (null si pas encore décidé). */
  joueurs: { id: string; gagnant: boolean | null }[];
  verifie: boolean;
}

export interface TournoiSignal {
  id: string;
  organisateurId: string;
  statut: string;
}

export interface VariationSignal {
  profileId: string;
  tournoiId: string | null;
  avant: number;
  apres: number;
}

export const SEUIL_RENCONTRES = 3;
export const SEUIL_HAUSSE = 150;
export const EFFECTIF_MAX_PETIT_TOURNOI = 4;

export interface Signaux {
  /** Mêmes deux joueurs, souvent face à face. */
  paires: { a: string; b: string; matchs: number; victoiresA: number; victoiresB: number }[];
  /** Organisateur inscrit dans le bracket de son propre tournoi. */
  organisateursJoueurs: { tournoiId: string; organisateurId: string }[];
  /** Hausse de rating d'un seul tournoi au-dessus du seuil. */
  hausses: VariationSignal[];
  /** Tournoi terminé à très faible effectif, avec des matchs vérifiés (il compte). */
  petitsTournois: { tournoiId: string; joueurs: number }[];
}

export function detecterSignaux(matchs: MatchSignal[], tournois: TournoiSignal[], variations: VariationSignal[]): Signaux {
  const paires = new Map<string, { a: string; b: string; matchs: number; victoiresA: number; victoiresB: number }>();
  const joueursParTournoi = new Map<string, Set<string>>();
  const verifiesParTournoi = new Map<string, number>();

  for (const m of matchs) {
    const ensemble = joueursParTournoi.get(m.tournoiId) ?? new Set<string>();
    m.joueurs.forEach((j) => ensemble.add(j.id));
    joueursParTournoi.set(m.tournoiId, ensemble);
    if (m.joueurs.length !== 2) continue;
    if (m.verifie) verifiesParTournoi.set(m.tournoiId, (verifiesParTournoi.get(m.tournoiId) ?? 0) + 1);

    const [x, y] = [...m.joueurs].sort((p, q) => p.id.localeCompare(q.id));
    const cle = `${x.id}|${y.id}`;
    const paire = paires.get(cle) ?? { a: x.id, b: y.id, matchs: 0, victoiresA: 0, victoiresB: 0 };
    paire.matchs += 1;
    if (x.gagnant) paire.victoiresA += 1;
    if (y.gagnant) paire.victoiresB += 1;
    paires.set(cle, paire);
  }

  return {
    paires: [...paires.values()].filter((p) => p.matchs >= SEUIL_RENCONTRES).sort((p, q) => q.matchs - p.matchs),
    organisateursJoueurs: tournois
      .filter((t) => joueursParTournoi.get(t.id)?.has(t.organisateurId))
      .map((t) => ({ tournoiId: t.id, organisateurId: t.organisateurId })),
    hausses: variations
      .filter((v) => v.apres - v.avant >= SEUIL_HAUSSE)
      .sort((v, w) => w.apres - w.avant - (v.apres - v.avant)),
    petitsTournois: tournois
      .filter(
        (t) =>
          t.statut === "termine" &&
          (joueursParTournoi.get(t.id)?.size ?? 0) <= EFFECTIF_MAX_PETIT_TOURNOI &&
          (verifiesParTournoi.get(t.id) ?? 0) > 0,
      )
      .map((t) => ({ tournoiId: t.id, joueurs: joueursParTournoi.get(t.id)?.size ?? 0 })),
  };
}
