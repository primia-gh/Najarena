import type { NiveauVerdict } from "@/lib/tournois";
import { niveauCompteSuffisant } from "@/lib/niveau-compte-riot";

// Face-à-face entre deux joueurs (19/11/2026) : leurs matchs 1v1, lus par
// la fonction face_a_face (docs/schema.sql). Le bilan ne compte que les
// verdicts lus chez Riot (niveaux 2 et 3), comme le classement : une
// décision manuelle, un forfait et un match dont un compte Riot était sous
// le niveau 30 (23/11/2026) sont listés, jamais comptés.

export interface MatchFaceAFace {
  matchId: string;
  joueLe: string;
  tournoiSlug: string;
  tournoiNom: string;
  nature: string;
  gagnantId: string | null;
  niveau: NiveauVerdict;
  forfait: boolean;
  /** Plus bas niveau Riot des deux comptes (depuis le 22/11/2026). */
  niveauCompteMin: number | null;
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
  niveau_compte_min?: number | null;
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
    niveauCompteMin: l.niveau_compte_min ?? null,
  };
}

/** Lu chez Riot, mais un compte était sous le niveau 30 : hors classement, hors bilan. */
export function horsClassementNiveau(m: MatchFaceAFace): boolean {
  return !m.forfait && m.niveau !== "manuel" && !niveauCompteSuffisant(m.niveauCompteMin);
}

/** Un match qui compte dans le bilan : lu chez Riot, joué (pas un forfait), avec un vainqueur, comptes de niveau 30. */
export function compteAuBilan(m: MatchFaceAFace): boolean {
  return !m.forfait && m.niveau !== "manuel" && m.gagnantId !== null && niveauCompteSuffisant(m.niveauCompteMin);
}

export interface BilanFaceAFace {
  victoiresA: number;
  victoiresB: number;
  /** Matchs comptés (lus chez Riot, joués). */
  verifies: number;
  /** Décisions de l'organisateur, hors bilan. */
  manuels: number;
  forfaits: number;
  /** Lus chez Riot, mais un compte sous le niveau 30. */
  horsClassement: number;
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
    horsClassement: matchs.filter(horsClassementNiveau).length,
    dernier: comptes[0] ?? null,
    serie,
  };
}

/** Adresse canonique d'un face-à-face : les deux adresses de profil dans l'ordre alphabétique. */
export function adresseCanonique(slugA: string, slugB: string): string {
  const [premier, second] = [slugA, slugB].sort();
  return `/lol/face-a-face/${premier}/${second}`;
}
