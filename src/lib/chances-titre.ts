// Chances de titre (09/10/2026, idée en réserve n°14) : la probabilité de
// chaque joueur de gagner le tournoi, avant le début et au fil des
// résultats. Calcul exact sur le bracket à élimination directe, à partir des
// chances de chaque duel (Glicko-2, lib/estimations.ts) et des ratings au
// début du tournoi. Une estimation, affichée comme telle (CLAUDE.md §4) —
// jamais un résultat. Logique pure, testée dans chances-titre.test.ts.

import { probabiliteVictoire } from "@/lib/glicko2";
import type { EtatRating } from "@/lib/estimations";

export interface MatchTitre {
  tour: number;
  position: number;
  /** Joueurs placés, par place (1 ou 2). */
  joueurs: { profileId: string; slot: number }[];
  /** Vainqueur décidé (verdict définitif), sinon null. */
  gagnant: string | null;
}

type Distribution = Map<string, number>;

/**
 * Probabilité de titre de chaque joueur. `avecResultats` : faux pour
 * « avant le tournoi » (seuls les joueurs placés au premier tour comptent),
 * vrai pour « maintenant » (les matchs décidés sont acquis).
 */
export function chancesDeTitre(
  matchs: MatchTitre[],
  etat: (profileId: string) => EtatRating,
  avecResultats: boolean,
): Map<string, number> {
  if (matchs.length === 0) return new Map();
  const parCase = new Map(matchs.map((m) => [`${m.tour}-${m.position}`, m]));
  const dernierTour = Math.max(...matchs.map((m) => m.tour));
  const memo = new Map<string, Distribution>();

  const distribution = (tour: number, position: number): Distribution => {
    const cle = `${tour}-${position}`;
    const deja = memo.get(cle);
    if (deja) return deja;
    const m = parCase.get(cle);

    let resultat: Distribution;
    if (avecResultats && m?.gagnant) {
      resultat = new Map([[m.gagnant, 1]]);
    } else {
      const [a, b] =
        tour === 1
          ? ([1, 2] as const).map((slot) => {
              const j = m?.joueurs.find((x) => x.slot === slot);
              return j ? new Map([[j.profileId, 1]]) : new Map<string, number>();
            })
          : [distribution(tour - 1, 2 * position - 1), distribution(tour - 1, 2 * position)];
      resultat = combiner(a, b, etat);
    }
    memo.set(cle, resultat);
    return resultat;
  };

  return distribution(dernierTour, 1);
}

/** Vainqueur d'un match entre deux côtés dont on connaît les distributions. */
function combiner(a: Distribution, b: Distribution, etat: (id: string) => EtatRating): Distribution {
  if (a.size === 0) return b;
  if (b.size === 0) return a;
  const resultat: Distribution = new Map();
  for (const [joueur, pJoueur] of a) {
    let gagne = 0;
    for (const [adversaire, pAdversaire] of b) gagne += pAdversaire * probabiliteVictoire(etat(joueur), etat(adversaire));
    resultat.set(joueur, pJoueur * gagne);
  }
  for (const [joueur, pJoueur] of b) {
    let gagne = 0;
    for (const [adversaire, pAdversaire] of a) gagne += pAdversaire * probabiliteVictoire(etat(joueur), etat(adversaire));
    resultat.set(joueur, pJoueur * gagne);
  }
  return resultat;
}

/** « 23 % », « < 1 % », « — » pour un joueur éliminé. */
export function formaterChance(p: number | undefined): string {
  if (p === undefined || p === 0) return "—";
  if (p < 0.005) return "< 1 %";
  if (p > 0.995 && p < 1) return "> 99 %";
  return `${Math.round(p * 100)} %`;
}
