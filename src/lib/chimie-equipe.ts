// Chimie d'équipe (09/10/2026, idée en réserve n°16) : les résultats d'une
// équipe selon les joueurs alignés ensemble, sur ses seuls matchs 5v5 lus
// chez Riot (fonction chimie_equipe en base). Logique pure, testée dans
// chimie-equipe.test.ts. Rien sous CHIMIE_MATCHS_MIN matchs vérifiés.

export const CHIMIE_MATCHS_MIN = 3;
/** Un duo ou une composition n'est montré qu'à partir de ce nombre de matchs. */
export const ENSEMBLE_MATCHS_MIN = 2;
export const DUOS_MAX = 8;
export const COMPOSITIONS_MAX = 5;

export interface MatchEquipe {
  gagne: boolean;
  joueurs: string[];
}

export interface Bilan {
  matchs: number;
  victoires: number;
}

export interface Chimie {
  total: Bilan;
  compositions: (Bilan & { joueurs: string[] })[];
  duos: (Bilan & { joueurs: [string, string] })[];
  /** Bilan de l'équipe avec et sans chaque joueur (sans = null s'il a joué tous les matchs). */
  joueurs: { id: string; avec: Bilan; sans: Bilan | null }[];
}

const ajouter = (b: Bilan, gagne: boolean) => {
  b.matchs += 1;
  if (gagne) b.victoires += 1;
};

const meilleurs = <T extends Bilan>(a: T, b: T) =>
  b.matchs - a.matchs || b.victoires / b.matchs - a.victoires / a.matchs;

export function pourcentageVictoires(b: Bilan): number {
  return b.matchs === 0 ? 0 : Math.round((b.victoires / b.matchs) * 100);
}

export function chimieEquipe(matchs: MatchEquipe[]): Chimie | null {
  if (matchs.length < CHIMIE_MATCHS_MIN) return null;

  const total: Bilan = { matchs: 0, victoires: 0 };
  const compositions = new Map<string, Bilan & { joueurs: string[] }>();
  const duos = new Map<string, Bilan & { joueurs: [string, string] }>();
  const avec = new Map<string, Bilan>();

  for (const m of matchs) {
    ajouter(total, m.gagne);
    const joueurs = [...new Set(m.joueurs)].sort();

    const cle = joueurs.join("|");
    const compo = compositions.get(cle) ?? { joueurs, matchs: 0, victoires: 0 };
    ajouter(compo, m.gagne);
    compositions.set(cle, compo);

    for (let i = 0; i < joueurs.length; i++) {
      const b = avec.get(joueurs[i]) ?? { matchs: 0, victoires: 0 };
      ajouter(b, m.gagne);
      avec.set(joueurs[i], b);
      for (let j = i + 1; j < joueurs.length; j++) {
        const cleDuo = `${joueurs[i]}|${joueurs[j]}`;
        const duo = duos.get(cleDuo) ?? { joueurs: [joueurs[i], joueurs[j]], matchs: 0, victoires: 0 };
        ajouter(duo, m.gagne);
        duos.set(cleDuo, duo);
      }
    }
  }

  return {
    total,
    compositions: [...compositions.values()]
      .filter((c) => c.matchs >= ENSEMBLE_MATCHS_MIN)
      .sort(meilleurs)
      .slice(0, COMPOSITIONS_MAX),
    duos: [...duos.values()]
      .filter((d) => d.matchs >= ENSEMBLE_MATCHS_MIN)
      .sort(meilleurs)
      .slice(0, DUOS_MAX),
    joueurs: [...avec.entries()]
      .map(([id, b]) => {
        const sans = { matchs: total.matchs - b.matchs, victoires: total.victoires - b.victoires };
        return { id, avec: b, sans: sans.matchs > 0 ? sans : null };
      })
      .sort((a, b) => meilleurs(a.avec, b.avec)),
  };
}
