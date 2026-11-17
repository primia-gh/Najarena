import { INDICATEURS, INDICATEURS_PAR_FORMAT, type CleIndicateur } from "./bilan";

// Bilan du joueur, étape 2 (05/10/2026) : « mieux que N % des joueurs Or au
// poste Milieu ». La base compare la moyenne du joueur à celles des autres
// joueurs du même rang Riot et du même poste (percentiles_classees,
// docs/schema.sql : 5 parties au moins chacun, 10 autres joueurs au moins,
// jamais leurs chiffres individuels). Logique pure, testée.

export const JOUEURS_MIN_POSITION = 10;

export interface PositionNiveau {
  indicateur: CleIndicateur;
  /** Part des autres joueurs que le joueur dépasse, entre 0 et 1 (les égalités comptent pour moitié). */
  mieuxQue: number;
  joueurs: number;
}

export function positionsNiveau(
  lignes: { indicateur: string; joueurs: number; en_dessous: number; egaux: number }[],
): PositionNiveau[] {
  return INDICATEURS_PAR_FORMAT.classees.flatMap((cle) => {
    const l = lignes.find((x) => x.indicateur === cle);
    if (!l || l.joueurs < JOUEURS_MIN_POSITION) return [];
    const plusBas = l.en_dessous + l.egaux / 2;
    const plusHaut = l.joueurs - l.en_dessous - l.egaux + l.egaux / 2;
    return [{ indicateur: cle, mieuxQue: (INDICATEURS[cle].sens === 1 ? plusBas : plusHaut) / l.joueurs, joueurs: l.joueurs }];
  });
}
