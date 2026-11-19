import type { NiveauVerdict } from "@/lib/tournois";

// Face-à-face entre deux joueurs (19/11/2026) : leurs matchs 1v1, lus par
// la fonction face_a_face (docs/schema.sql). Le bilan ne compte que les
// verdicts lus chez Riot (niveaux 2 et 3), comme le classement : une
// décision manuelle et un forfait sont listés, jamais comptés.

export interface MatchFaceAFace {
  matchId: string;
  joueLe: string;
  tournoiSlug: string;
  tournoiNom: string;
  nature: string;
  gagnantId: string | null;
  niveau: NiveauVerdict;
  forfait: boolean;
}

export interface LigneFaceAFace {
  match_id: string;
  joue_le: string;
  tournoi_slug: string;
  tournoi_nom: string;
  nature: string;
  gagnant_id: string | null;
  niveau: NiveauVerdict;
  forfait: boolean;
}

export function depuisLigne(l: LigneFaceAFace): MatchFaceAFace {
  return {
    matchId: l.match_id,
    joueLe: l.joue_le,
    tournoiSlug: l.tournoi_slug,
    tournoiNom: l.tournoi_nom,
    nature: l.nature,
    gagnantId: l.gagnant_id,
    niveau: l.niveau,
    forfait: l.forfait,
  };
}

/** Un match qui compte dans le bilan : lu chez Riot, joué (pas un forfait), avec un vainqueur. */
export function compteAuBilan(m: MatchFaceAFace): boolean {
  return !m.forfait && m.niveau !== "manuel" && m.gagnantId !== null;
}

export interface BilanFaceAFace {
  victoiresA: number;
  victoiresB: number;
  /** Matchs comptés (lus chez Riot, joués). */
  verifies: number;
  /** Décisions de l'organisateur, hors bilan. */
  manuels: number;
  forfaits: number;
  /** Dernier match compté. */
  dernier: MatchFaceAFace | null;
  /** Série en cours : victoires d'affilée du dernier vainqueur, sur les matchs comptés. */
  serie: { gagnantId: string; longueur: number } | null;
}

/** `matchs` du plus récent au plus ancien (ordre de face_a_face). */
export function bilanFaceAFace(matchs: MatchFaceAFace[], a: string, b: string): BilanFaceAFace {
  const comptes = matchs.filter(compteAuBilan);
  let serie: BilanFaceAFace["serie"] = null;
  for (const m of comptes) {
    if (!serie) serie = { gagnantId: m.gagnantId as string, longueur: 1 };
    else if (m.gagnantId === serie.gagnantId) serie.longueur += 1;
    else break;
  }
  return {
    victoiresA: comptes.filter((m) => m.gagnantId === a).length,
    victoiresB: comptes.filter((m) => m.gagnantId === b).length,
    verifies: comptes.length,
    manuels: matchs.filter((m) => !m.forfait && m.niveau === "manuel").length,
    forfaits: matchs.filter((m) => m.forfait).length,
    dernier: comptes[0] ?? null,
    serie,
  };
}

/** Adresse canonique d'un face-à-face : les deux adresses de profil dans l'ordre alphabétique. */
export function adresseCanonique(slugA: string, slugB: string): string {
  const [premier, second] = [slugA, slugB].sort();
  return `/lol/face-a-face/${premier}/${second}`;
}
