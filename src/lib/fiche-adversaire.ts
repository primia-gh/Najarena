// Fiche de l'adversaire (09/10/2026, idée en réserve n°9) : dans la salle de
// match 1v1, les champions que l'adversaire a joués dans ses parties
// vérifiées (lues chez Riot) et ses résultats. Des noms seulement, jamais
// de visuel Riot (CLAUDE.md §7). Logique pure, testée dans
// fiche-adversaire.test.ts. Rien sous FICHE_PARTIES_MIN parties.

import { LIBELLE_POSTE } from "@/lib/bilan";

export const FICHE_PARTIES_MIN = 3;
export const FICHE_CHAMPIONS_MAX = 4;

export interface PartieAdversaire {
  champion: string;
  gagne: boolean;
  poste: string | null;
}

export interface FicheAdversaire {
  parties: number;
  victoires: number;
  /** Poste le plus joué, s'il est connu dans au moins la moitié des parties. */
  poste: string | null;
  champions: { nom: string; parties: number; victoires: number }[];
}

export function ficheAdversaire(parties: PartieAdversaire[]): FicheAdversaire | null {
  if (parties.length < FICHE_PARTIES_MIN) return null;

  const parChampion = new Map<string, { parties: number; victoires: number }>();
  for (const p of parties) {
    const c = parChampion.get(p.champion) ?? { parties: 0, victoires: 0 };
    c.parties += 1;
    if (p.gagne) c.victoires += 1;
    parChampion.set(p.champion, c);
  }
  const champions = [...parChampion.entries()]
    .map(([nom, c]) => ({ nom, ...c }))
    .sort((a, b) => b.parties - a.parties || b.victoires - a.victoires || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, FICHE_CHAMPIONS_MAX);

  const parPoste = new Map<string, number>();
  for (const p of parties) if (p.poste) parPoste.set(p.poste, (parPoste.get(p.poste) ?? 0) + 1);
  const [posteFrequent] = [...parPoste.entries()].sort((a, b) => b[1] - a[1]);
  const poste =
    posteFrequent && posteFrequent[1] * 2 >= parties.length ? (LIBELLE_POSTE[posteFrequent[0]] ?? null) : null;

  return {
    parties: parties.length,
    victoires: parties.filter((p) => p.gagne).length,
    poste,
    champions,
  };
}
