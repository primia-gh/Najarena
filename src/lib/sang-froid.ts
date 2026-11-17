import { INDICATEURS, postePrincipal, type CleIndicateur, type PartieBilan } from "./bilan";

// Indice de sang-froid (bilan du joueur, étape 2, 05/10/2026) : le joueur
// fait-il en tournoi 5v5 ce qu'il fait en classée ? Najarena est le seul à
// voir les deux. Comparé sur la même carte (Faille de l'invocateur) et au
// même poste quand il est connu ; jamais avec le 1v1, qui n'a pas
// d'équivalent en classée. Logique pure, testée.

export const PARTIES_TOURNOI_SANG_FROID = 5;
export const PARTIES_CLASSEES_SANG_FROID = 10;
const SEUIL_VERDICT = 0.25; // en écarts types des classées

/** Indicateurs comparables d'un contexte à l'autre (pas le KDA ni l'or, qui suivent l'issue). */
const INDICATEURS_SANG_FROID: CleIndicateur[] = ["sbires_min", "morts_10min", "degats_min", "part_kills", "vision_min"];

export interface EcartSangFroid {
  indicateur: CleIndicateur;
  tournoi: number;
  classees: number;
  /** En écarts types des classées, positif = mieux en tournoi. */
  ecart: number;
}

export interface SangFroid {
  indice: number;
  verdict: "pression_positive" | "constant" | "crispe";
  poste: string | null;
  partiesTournoi: number;
  partiesClassees: number;
  ecarts: EcartSangFroid[];
}

function moyenne(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function ecartType(v: number[]): number {
  if (v.length < 2) return 0;
  const m = moyenne(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

function valeurs(parties: PartieBilan[], cle: CleIndicateur): number[] {
  return parties.flatMap((p) => {
    const v = p.valeurs[cle];
    return typeof v === "number" && Number.isFinite(v) ? [v] : [];
  });
}

export function sangFroid(tournoi: PartieBilan[], classees: PartieBilan[]): SangFroid | null {
  // Même poste des deux côtés si possible ; sinon toutes les parties.
  const poste = postePrincipal(tournoi);
  const t = poste ? tournoi.filter((p) => p.poste === poste) : tournoi;
  const c = poste ? classees.filter((p) => p.poste === poste) : classees;
  const [enTournoi, enClassee, posteRetenu] =
    poste && t.length >= PARTIES_TOURNOI_SANG_FROID && c.length >= PARTIES_CLASSEES_SANG_FROID
      ? [t, c, poste]
      : [tournoi, classees, null];
  if (enTournoi.length < PARTIES_TOURNOI_SANG_FROID || enClassee.length < PARTIES_CLASSEES_SANG_FROID) return null;

  const ecarts = INDICATEURS_SANG_FROID.flatMap((cle) => {
    const vt = valeurs(enTournoi, cle);
    const vc = valeurs(enClassee, cle);
    const dispersion = ecartType(vc);
    if (vt.length < PARTIES_TOURNOI_SANG_FROID || vc.length < PARTIES_CLASSEES_SANG_FROID || dispersion <= 0) return [];
    const mt = moyenne(vt);
    const mc = moyenne(vc);
    return [{ indicateur: cle, tournoi: mt, classees: mc, ecart: (INDICATEURS[cle].sens * (mt - mc)) / dispersion }];
  });
  if (ecarts.length < 3) return null;

  const indice = moyenne(ecarts.map((e) => e.ecart));
  return {
    indice,
    verdict: indice >= SEUIL_VERDICT ? "pression_positive" : indice <= -SEUIL_VERDICT ? "crispe" : "constant",
    poste: posteRetenu,
    partiesTournoi: enTournoi.length,
    partiesClassees: enClassee.length,
    ecarts,
  };
}

export const VERDICT_SANG_FROID: Record<SangFroid["verdict"], { titre: string; texte: string }> = {
  pression_positive: {
    titre: "Joueur de tournoi",
    texte: "Tes chiffres montent en tournoi : la pression te réussit.",
  },
  constant: {
    titre: "Sang-froid",
    texte: "Tu joues en tournoi comme en classée : la pression ne change pas ton jeu.",
  },
  crispe: {
    titre: "Crispé sous pression",
    texte: "Tes chiffres baissent en tournoi : la pression te fait jouer en dessous de ton niveau de classée.",
  },
};
