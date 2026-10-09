// « Recalcule toi-même » (09/10/2026, idée en réserve n°4) : le calcul
// Glicko-2 d'un joueur refait dans le navigateur du visiteur, ligne par
// ligne, à partir du registre public et des résultats publics. Mêmes règles
// que la clôture d'un tournoi (lib/classement-actions.ts) : seuls les
// verdicts lus chez Riot comptent, jamais un forfait, et au-delà de 3
// victoires contre le même adversaire en 24 h les suivantes sont ignorées.
// Logique pure, testée dans recalcul.test.ts — le même moteur que le
// serveur (lib/glicko2.ts), exécuté chez le visiteur.
//
// La volatilité (troisième valeur de Glicko-2) n'est pas dans le registre :
// on la reconstitue en rejouant tout l'historique du joueur depuis sa
// première ligne (0,06 au départ), arrondie comme en base (6 décimales).

import { mettreAJourJoueur, softResetSaison, VOLATILITE_INITIALE, type ResultatMatch } from "@/lib/glicko2";

export const NIVEAUX_COMPTES = ["code_tournoi", "historique"] as const;
export const PLAFOND_VICTOIRES_24H = 3;
/** Écart toléré : le registre garde 2 décimales. */
export const TOLERANCE = 0.011;

export interface LigneRegistreJoueur {
  numero: number;
  motif: string;
  tournament_id: string | null;
  rating_avant: number;
  rd_avant: number;
  rating_apres: number;
  rd_apres: number;
}

export interface MatchJoueur {
  id: string;
  tournament_id: string;
  statut: string;
  adversaire_id: string | null;
  verdict: { niveau: string; gagnant_id: string | null; cree_le: string } | null;
}

export interface DonneesRecalcul {
  profileId: string;
  lignes: LigneRegistreJoueur[];
  /** Tous les matchs du joueur (toutes compétitions), avec leur verdict définitif. */
  matchs: MatchJoueur[];
  /** État de départ (registre) de chaque joueur de chaque tournoi : tournoi → joueur → état. */
  departs: Record<string, Record<string, { rating_avant: number; rd_avant: number }>>;
}

export type EtatLigne = "concorde" | "ecart" | "non_verifiable";

export interface LigneRecalculee {
  numero: number;
  motif: string;
  tournamentId: string | null;
  publie: { rating: number; rd: number };
  calcule: { rating: number; rd: number } | null;
  etat: EtatLigne;
  /** Matchs comptés (tournoi), ou explication. */
  detail: string;
  /** Le « avant » de cette ligne suit-il le « après » de la précédente ? */
  continue: boolean;
}

const arrondi = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function compte(m: MatchJoueur): boolean {
  return (
    m.statut !== "forfait" &&
    m.verdict !== null &&
    m.verdict.gagnant_id !== null &&
    (NIVEAUX_COMPTES as readonly string[]).includes(m.verdict.niveau)
  );
}

/** Résultats retenus d'un tournoi pour le joueur, dans l'ordre des verdicts. */
export function resultatsDuTournoi(d: DonneesRecalcul, tournoiId: string): ResultatMatch[] | null {
  const departs = d.departs[tournoiId] ?? {};
  const candidats = d.matchs
    .filter((m) => m.tournament_id === tournoiId && compte(m) && m.adversaire_id)
    .sort((a, b) => Date.parse(a.verdict!.cree_le) - Date.parse(b.verdict!.cree_le));

  const resultats: ResultatMatch[] = [];
  for (const m of candidats) {
    const gagnant = m.verdict!.gagnant_id!;
    const perdant = gagnant === d.profileId ? m.adversaire_id! : d.profileId;
    const instant = Date.parse(m.verdict!.cree_le);
    // Victoires du même gagnant contre le même perdant dans les 24 h qui
    // précèdent (toutes compétitions) : au-delà de 3, ignorée.
    const prealables = d.matchs.filter((x) => {
      if (!compte(x) || x.id === m.id) return false;
      const t = Date.parse(x.verdict!.cree_le);
      const memePaire =
        x.verdict!.gagnant_id === gagnant &&
        (gagnant === d.profileId ? x.adversaire_id === perdant : x.adversaire_id === gagnant);
      return memePaire && t >= instant - 24 * 3_600_000 && t < instant;
    }).length;
    if (prealables >= PLAFOND_VICTOIRES_24H) continue;

    const adversaire = departs[m.adversaire_id!];
    if (!adversaire) return null; // état de départ de l'adversaire absent du registre
    resultats.push({
      adversaire: { rating: adversaire.rating_avant, rd: adversaire.rd_avant, volatilite: VOLATILITE_INITIALE },
      score: gagnant === d.profileId ? 1 : 0,
    });
  }
  return resultats;
}

export function recalculer(d: DonneesRecalcul): LigneRecalculee[] {
  let volatilite = VOLATILITE_INITIALE;
  let precedente: LigneRegistreJoueur | null = null;
  const sortie: LigneRecalculee[] = [];

  for (const l of [...d.lignes].sort((a, b) => a.numero - b.numero)) {
    const avant = { rating: l.rating_avant, rd: l.rd_avant, volatilite };
    const publie = { rating: l.rating_apres, rd: l.rd_apres };
    // Une nouvelle saison repart du soft reset : sa ligne fait la jonction.
    const continuite =
      precedente === null ||
      (Math.abs(precedente.rating_apres - l.rating_avant) < TOLERANCE &&
        Math.abs(precedente.rd_apres - l.rd_avant) < TOLERANCE);

    let calcule: { rating: number; rd: number; volatilite: number } | null = null;
    let detail = "";
    if (l.motif === "tournoi" && l.tournament_id) {
      const resultats = resultatsDuTournoi(d, l.tournament_id);
      if (resultats) {
        calcule = mettreAJourJoueur(avant, resultats);
        detail = `${resultats.length} match${resultats.length > 1 ? "s" : ""} compté${resultats.length > 1 ? "s" : ""}`;
      } else {
        detail = "État d'un adversaire introuvable dans le registre";
      }
    } else if (l.motif === "tournoi") {
      detail = "Tournoi non précisé dans le registre";
    } else if (l.motif === "inactivite") {
      calcule = mettreAJourJoueur(avant, []);
      detail = "Inactivité : l'incertitude remonte, le rating ne bouge pas";
    } else if (l.motif === "soft_reset") {
      calcule = softResetSaison(avant);
      detail = "Nouvelle saison : 15 % vers 1500, RD × 1,8";
    } else {
      detail = "Correction : pas de formule à refaire";
    }

    const etat: EtatLigne = !calcule
      ? "non_verifiable"
      : Math.abs(calcule.rating - publie.rating) <= TOLERANCE && Math.abs(calcule.rd - publie.rd) <= TOLERANCE
        ? "concorde"
        : "ecart";
    sortie.push({
      numero: l.numero,
      motif: l.motif,
      tournamentId: l.tournament_id,
      publie,
      calcule: calcule ? { rating: arrondi(calcule.rating, 2), rd: arrondi(calcule.rd, 2) } : null,
      etat,
      detail,
      continue: continuite,
    });
    if (calcule) volatilite = arrondi(calcule.volatilite, 6);
    precedente = l;
  }
  return sortie;
}
