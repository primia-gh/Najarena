// Divisions mensuelles (09/10/2026, idée en réserve n°13) : logique pure,
// testée dans divisions.test.ts. La base garde les règles (inscription,
// poules de 3 ou 4, « Je suis là », duels) ; ici, l'ordre de départ des
// poules, leur classement et les montées / descentes.
//
// Ordre de départ d'une ligue : les joueurs de la ligue précédente de la
// région gardent leur ordre final, le premier de chaque poule montant d'un
// cran, le dernier descendant ; les nouveaux s'insèrent selon leur rating
// (avant le premier ancien au rating plus bas). Puis on coupe en poules de
// 4 (ou 3 pour tomber juste) ; avec 5 inscrits, le dernier inscrit attend
// le mois suivant (premiers inscrits servis en premier).

import { GLICKO_BASE } from "@/lib/glicko2";

export const TAILLE_POULE = 4;
export const SEMAINES_LIGUE = 4;
export const DELAI_PRESENCE_MINUTES = 30;

export type Mouvement = "monte" | "descend" | "reste";

export interface Inscrit {
  id: string;
  rating: number | null;
  inscritLe: string;
}

export interface ResultatPrecedent {
  id: string;
  niveau: number;
  rang: number;
  mouvement: Mouvement | null;
}

/** Tailles des poules (de la plus forte à la plus faible) pour n inscrits. */
export function taillesPoules(n: number): number[] {
  if (n < 3) return [];
  let k = Math.ceil(n / TAILLE_POULE);
  if (3 * k > n) k = Math.floor(n / TAILLE_POULE);
  const retenus = Math.min(n, TAILLE_POULE * k);
  const base = Math.floor(retenus / k);
  const enPlus = retenus % k;
  return Array.from({ length: k }, (_, i) => base + (i < enPlus ? 1 : 0));
}

export function ordreDepart(inscrits: Inscrit[], precedent: ResultatPrecedent[]): string[] {
  const rating = new Map(inscrits.map((i) => [i.id, i.rating ?? GLICKO_BASE]));
  const anciens = precedent
    .filter((p) => rating.has(p.id))
    .map((p) => ({
      id: p.id,
      niveau: p.niveau + (p.mouvement === "monte" ? -1 : p.mouvement === "descend" ? 1 : 0),
      // Qui monte ferme la poule du dessus ; qui descend ouvre celle du dessous.
      sousOrdre: p.mouvement === "monte" ? 1000 : p.mouvement === "descend" ? -1000 : 0,
      rang: p.rang,
    }))
    .sort((a, b) => a.niveau - b.niveau || a.sousOrdre - b.sousOrdre || a.rang - b.rang)
    .map((a) => a.id);
  const dejaLa = new Set(anciens);

  const ordre = [...anciens];
  const nouveaux = inscrits
    .filter((i) => !dejaLa.has(i.id))
    .sort((a, b) => (b.rating ?? GLICKO_BASE) - (a.rating ?? GLICKO_BASE) || a.inscritLe.localeCompare(b.inscritLe));
  // Du plus fort au plus faible : chacun juste avant le premier ancien au
  // rating plus bas, donc après les nouveaux plus forts déjà placés.
  for (const n of nouveaux) {
    const r = n.rating ?? GLICKO_BASE;
    const i = ordre.findIndex((id) => dejaLa.has(id) && (rating.get(id) ?? GLICKO_BASE) < r);
    if (i === -1) ordre.push(n.id);
    else ordre.splice(i, 0, n.id);
  }
  return ordre;
}

export interface Repartition {
  poules: string[][];
  /** Inscrits sans place ce mois-ci (les derniers inscrits). */
  enAttente: string[];
}

export function repartirPoules(inscrits: Inscrit[], precedent: ResultatPrecedent[]): Repartition {
  const tailles = taillesPoules(inscrits.length);
  const places = tailles.reduce((s, t) => s + t, 0);
  const parInscription = [...inscrits].sort((a, b) => a.inscritLe.localeCompare(b.inscritLe));
  const retenus = parInscription.slice(0, places);
  const enAttente = parInscription.slice(places).map((i) => i.id);

  const ordre = ordreDepart(retenus, precedent);
  const poules: string[][] = [];
  let debut = 0;
  for (const t of tailles) {
    poules.push(ordre.slice(debut, debut + t));
    debut += t;
  }
  return { poules, enAttente };
}

export interface RencontreJouee {
  joueurA: string;
  joueurB: string;
  gagnantId: string | null;
  niveauVerdict: string | null;
}

export interface LigneClassement {
  id: string;
  joues: number;
  victoires: number;
  defaites: number;
  /** Victoires lues chez Riot (hors forfait de l'adversaire). */
  victoiresVerifiees: number;
}

/**
 * Classement d'une poule : victoires (lues chez Riot ou par forfait de
 * l'adversaire), puis victoires lues chez Riot, puis confrontation directe
 * entre deux joueurs à égalité, puis ordre de départ. À trois joueurs ou
 * plus à égalité, la confrontation directe peut tourner en rond (A bat B,
 * B bat C, C bat A) : l'ordre de départ départage alors seul (contrôle du
 * testeur du 11/10/2026 — le premier dépendait de l'ordre de lecture).
 */
export function classementPoule(membres: { id: string; ordre: number }[], rencontres: RencontreJouee[]): LigneClassement[] {
  const lignes = new Map(membres.map((m) => [m.id, { id: m.id, joues: 0, victoires: 0, defaites: 0, victoiresVerifiees: 0 }]));
  const vainqueur = new Map<string, string>();
  for (const r of rencontres) {
    if (!r.gagnantId) continue;
    const perdant = r.gagnantId === r.joueurA ? r.joueurB : r.joueurA;
    const g = lignes.get(r.gagnantId);
    const p = lignes.get(perdant);
    if (!g || !p) continue;
    g.joues += 1;
    p.joues += 1;
    g.victoires += 1;
    p.defaites += 1;
    if (r.niveauVerdict && r.niveauVerdict !== "manuel") g.victoiresVerifiees += 1;
    vainqueur.set([r.joueurA, r.joueurB].sort().join("|"), r.gagnantId);
  }
  const ordre = new Map(membres.map((m) => [m.id, m.ordre]));
  const egaux = (a: LigneClassement, b: LigneClassement) =>
    a.victoires === b.victoires && a.victoiresVerifiees === b.victoiresVerifiees;
  const tries = [...lignes.values()].sort(
    (a, b) =>
      b.victoires - a.victoires ||
      b.victoiresVerifiees - a.victoiresVerifiees ||
      (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0),
  );
  // Confrontation directe : seulement entre exactement deux joueurs à égalité.
  for (let i = 0; i < tries.length; ) {
    let j = i + 1;
    while (j < tries.length && egaux(tries[i], tries[j])) j++;
    if (j - i === 2 && vainqueur.get([tries[i].id, tries[i + 1].id].sort().join("|")) === tries[i + 1].id) {
      [tries[i], tries[i + 1]] = [tries[i + 1], tries[i]];
    }
    i = j;
  }
  return tries;
}

/**
 * Une poule « a joué » si au moins un de ses matchs a été gagné sur une
 * partie lue chez Riot : un forfait ou une décision manuelle ne suffit pas
 * (contrôle de sécurité du 11/10/2026).
 */
export function pouleJouee(classement: LigneClassement[]): boolean {
  return classement.some((l) => l.victoiresVerifiees > 0);
}

/**
 * Y a-t-il un échange entre une poule et celle du dessous ? Seulement si
 * les deux ont joué (une victoire lue chez Riot au moins) et si le premier
 * de la poule du dessous a lui-même gagné un match lu chez Riot : personne
 * ne monte sans victoire, un absent peut descendre (décisions du porteur du
 * projet, 11/10/2026). L'échange est symétrique : un « monte » d'un côté,
 * un « descend » de l'autre, jamais l'un sans l'autre.
 */
export function echangeEntre(dessus: LigneClassement[], dessous: LigneClassement[]): boolean {
  return pouleJouee(dessus) && pouleJouee(dessous) && (dessous[0]?.victoiresVerifiees ?? 0) > 0;
}

/**
 * Le premier monte (sauf en poule 1), le dernier descend (sauf en dernière
 * poule), si l'échange a lieu à la frontière concernée. `echange(n)` dit
 * s'il a lieu entre la poule n et la poule n + 1 (echangeEntre).
 */
export function mouvementDe(
  rang: number,
  taille: number,
  niveau: number,
  nbPoules: number,
  echange: (frontiere: number) => boolean,
): Mouvement {
  if (rang === 1 && niveau > 1 && echange(niveau - 1)) return "monte";
  if (rang === taille && niveau < nbPoules && echange(niveau)) return "descend";
  return "reste";
}

/** Semaine de la ligue (1 à 4), 0 avant le début, 5 après la fin. */
export function semaineLigue(debutLe: string, maintenant: Date): number {
  const jours = (maintenant.getTime() - Date.parse(debutLe)) / 86_400_000;
  if (jours < 0) return 0;
  return Math.min(SEMAINES_LIGUE + 1, Math.floor(jours / 7) + 1);
}

export const LIBELLE_MOUVEMENT: Record<Mouvement, string> = {
  monte: "Monte",
  descend: "Descend",
  reste: "Reste",
};

const REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi d'abord.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  COMPTE_RIOT_REQUIS: "Il faut un compte Riot vérifié : c'est lui qui fixe ta région et permet de lire tes résultats.",
  INSCRIPTIONS_FERMEES: "Les inscriptions de cette ligue sont closes.",
  RENCONTRE_INTROUVABLE: "Ce match n'est pas le tien.",
  RENCONTRE_HORS_DELAI: "Ce match ne se joue pas maintenant : attends sa semaine (la ligue dure quatre semaines).",
  MATCH_DEJA_LANCE: "Ce match est déjà lancé : rejoins la salle de match.",
  RENCONTRE_JOUEE: "Ce match est déjà joué.",
  MATCH_OUVERT_ENTRE_VOUS:
    "Vous avez déjà un match en cours l'un contre l'autre (tournoi ou défi) : jouez-le d'abord, une même partie ne compte qu'une fois.",
  TROP_DE_DEFIS_EN_COURS: "L'un de vous a déjà 3 défis en cours : jouez-les d'abord.",
  AUCUN_ARBITRE: "Aucun arbitre disponible pour l'instant : réessaie plus tard.",
};

export function messageRefusDivision(erreur: string): string {
  const code = Object.keys(REFUS).find((c) => erreur.includes(c));
  return code ? REFUS[code] : "Action impossible pour l'instant.";
}
