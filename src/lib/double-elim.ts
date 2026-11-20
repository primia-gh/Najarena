// Double élimination (20/11/2026). Les deux tableaux, la grande finale, la
// descente des perdants et les exemptions sont gérés par la base
// (demarrer_double_elim, avancer_vainqueur, resoudre_double_elim,
// docs/schema.sql) ; ici, les libellés et le récit.
//
// Numéros de tour posés par la base : tableau des gagnants 1..k, tableau
// des perdants k+1..k+2(k-1), grande finale 3k-1.

export type Tableau = "gagnants" | "perdants" | "finale";

export function estTableau(valeur: string | null | undefined): valeur is Tableau {
  return valeur === "gagnants" || valeur === "perdants" || valeur === "finale";
}

/** Un match clos sans aucun joueur (deux places d'origine vides) : jamais affiché. */
export function estMatchVide(m: { statut: string; match_participants: unknown[] }): boolean {
  return m.statut === "termine" && m.match_participants.length === 0;
}

/**
 * Nom d'une colonne : « Gagnants · tour 1 », « Finale des gagnants »,
 * « Perdants · tour 2 », « Finale des perdants », « Grande finale ».
 * `toursGagnants` : nombre de tours du tableau des gagnants (k).
 */
export function libelleTourDouble(tableau: Tableau, tour: number, toursGagnants: number): string {
  if (tableau === "finale") return "Grande finale";
  if (tableau === "gagnants") return tour === toursGagnants ? "Finale des gagnants" : `Gagnants · tour ${tour}`;
  const tourPerdants = tour - toursGagnants;
  return tourPerdants === 2 * (toursGagnants - 1) ? "Finale des perdants" : `Perdants · tour ${tourPerdants}`;
}

/** Récit factuel d'une double élimination terminée. */
export function recitDouble(nom: string, gagnant: string, finaliste: string | null, joueurs: number): string[] {
  return [
    `${gagnant} remporte ${nom} en double élimination (${joueurs} joueurs)${finaliste ? `, en grande finale contre ${finaliste}` : ""}.`,
    "Un joueur n'est éliminé qu'à sa deuxième défaite, sauf en grande finale, jouée en un seul match : le perdant y est éliminé. Les exemptions (places vides) ne comptent jamais au classement Najarena.",
  ];
}
