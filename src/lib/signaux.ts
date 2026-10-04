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
// Groupe fermé : de 3 à 8 joueurs, au moins 6 matchs vérifiés entre eux,
// 80 % au moins de leurs matchs vérifiés joués entre eux, alors que
// d'autres joueurs étaient actifs.
export const TAILLE_MIN_GROUPE = 3;
export const TAILLE_MAX_GROUPE = 8;
export const MATCHS_MIN_GROUPE = 6;
export const PART_INTERNE_MIN = 0.8;

export interface GroupeFerme {
  joueurs: string[];
  /** Matchs vérifiés joués entre membres du groupe. */
  matchsInternes: number;
  /** Part de leurs matchs vérifiés joués entre eux (0 à 1). */
  part: number;
}

export interface Signaux {
  /** Mêmes deux joueurs, souvent face à face. */
  paires: { a: string; b: string; matchs: number; victoiresA: number; victoiresB: number }[];
  /** Organisateur inscrit dans le bracket de son propre tournoi. */
  organisateursJoueurs: { tournoiId: string; organisateurId: string }[];
  /** Hausse de rating d'un seul tournoi au-dessus du seuil. */
  hausses: VariationSignal[];
  /** Tournoi terminé à très faible effectif, avec des matchs vérifiés (il compte). */
  petitsTournois: { tournoiId: string; joueurs: number }[];
  /** Petit groupe de joueurs qui ne jouent presque qu'entre eux. */
  groupesFermes: GroupeFerme[];
}

/**
 * Petits groupes fermés : on relie deux joueurs qui se sont affrontés au
 * moins deux fois (matchs vérifiés), on prend les groupes ainsi formés de
 * 3 à 8 joueurs, et on garde ceux qui jouent presque uniquement entre eux.
 */
export function detecterGroupesFermes(matchs: MatchSignal[]): GroupeFerme[] {
  const duels = matchs.filter((m) => m.verifie && m.joueurs.length === 2).map((m) => [m.joueurs[0].id, m.joueurs[1].id]);
  const rencontres = new Map<string, number>();
  for (const [a, b] of duels) {
    const cle = [a, b].sort().join("|");
    rencontres.set(cle, (rencontres.get(cle) ?? 0) + 1);
  }

  const voisins = new Map<string, Set<string>>();
  for (const [cle, nombre] of rencontres) {
    if (nombre < 2) continue;
    const [a, b] = cle.split("|");
    voisins.set(a, (voisins.get(a) ?? new Set<string>()).add(b));
    voisins.set(b, (voisins.get(b) ?? new Set<string>()).add(a));
  }

  const actifs = new Set(duels.flat());
  const vus = new Set<string>();
  const groupes: GroupeFerme[] = [];
  for (const depart of voisins.keys()) {
    if (vus.has(depart)) continue;
    const groupe = new Set<string>([depart]);
    const aVisiter = [depart];
    vus.add(depart);
    while (aVisiter.length > 0) {
      const joueur = aVisiter.pop() as string;
      for (const voisin of voisins.get(joueur) ?? []) {
        if (vus.has(voisin)) continue;
        vus.add(voisin);
        groupe.add(voisin);
        aVisiter.push(voisin);
      }
    }
    if (groupe.size < TAILLE_MIN_GROUPE || groupe.size > TAILLE_MAX_GROUPE) continue;
    // Sans autres joueurs actifs, jouer entre soi n'a rien de suspect.
    if (actifs.size - groupe.size < groupe.size) continue;

    let internes = 0;
    let total = 0;
    for (const [a, b] of duels) {
      const dedans = Number(groupe.has(a)) + Number(groupe.has(b));
      if (dedans > 0) total += 1;
      if (dedans === 2) internes += 1;
    }
    if (internes >= MATCHS_MIN_GROUPE && internes / total >= PART_INTERNE_MIN) {
      groupes.push({ joueurs: [...groupe].sort(), matchsInternes: internes, part: internes / total });
    }
  }
  return groupes.sort((g, h) => h.matchsInternes - g.matchsInternes);
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
    groupesFermes: detecterGroupesFermes(matchs),
  };
}
