// Récit d'un tournoi terminé (28/09/2026, audit N26) : quelques phrases
// factuelles, tirées du bracket — vainqueur et finale, parcours, exploit
// du tournoi, part des matchs vérifiés chez Riot. Aucune invention : ce que
// les données ne disent pas n'est pas écrit. Logique pure, testée dans
// recit-tournoi.test.ts ; affichée sur la page du tournoi et reprise dans
// l'annonce Discord du vainqueur.

export type NiveauRecit = "code_tournoi" | "historique" | "manuel";

export interface MatchRecit {
  tour: number;
  participants: { id: string; pseudo: string; score: number | null }[];
  /** Verdict définitif du match (null : pas encore décidé). */
  verdict: { niveau: NiveauRecit; gagnantId: string | null } | null;
}

export interface DonneesRecit {
  nom: string;
  nbJoueurs: number;
  bestOf: number;
  matchs: MatchRecit[];
  /** Chances qu'avait le vainqueur d'un match avant de le jouer (0 à 1). */
  chances?: (gagnantId: string, perdantId: string) => number;
  /** Tournoi 5v5 (audit N21) : des équipes, hors classement individuel. */
  equipes?: boolean;
}

const SEUIL_EXPLOIT = 0.35;

function nomTour(tour: number, dernierTour: number): string {
  const reste = dernierTour - tour + 1;
  if (reste === 1) return "en finale";
  if (reste === 2) return "en demi-finale";
  if (reste === 3) return "en quart de finale";
  if (reste === 4) return "en huitième de finale";
  return tour === 1 ? "au premier tour" : `au ${tour}e tour`;
}

function liste(noms: string[]): string {
  if (noms.length <= 1) return noms.join("");
  return `${noms.slice(0, -1).join(", ")} puis ${noms[noms.length - 1]}`;
}

/** Phrases du récit, ou null tant que la finale n'est pas décidée. */
export function recitTournoi(d: DonneesRecit): string[] | null {
  if (d.matchs.length === 0) return null;
  const dernierTour = Math.max(...d.matchs.map((m) => m.tour));
  const finale = d.matchs.find((m) => m.tour === dernierTour);
  if (!finale?.verdict?.gagnantId || finale.participants.length !== 2) return null;

  const pseudo = (id: string) =>
    d.matchs.flatMap((m) => m.participants).find((p) => p.id === id)?.pseudo ?? "un joueur";
  const vainqueurId = finale.verdict.gagnantId;
  const vainqueur = pseudo(vainqueurId);
  const finaliste = finale.participants.find((p) => p.id !== vainqueurId);
  const scoreGagnant = finale.participants.find((p) => p.id === vainqueurId)?.score;
  const phrases: string[] = [];

  // 1. Vainqueur et finale.
  const joueurs = `${d.nbJoueurs} ${d.equipes ? "équipe" : "joueur"}${d.nbJoueurs > 1 ? "s" : ""}`;
  if (finale.verdict.niveau === "manuel") {
    phrases.push(
      `${vainqueur} remporte ${d.nom} (${joueurs}) : la finale contre ${finaliste?.pseudo ?? "son adversaire"} a été tranchée par l'organisateur (verdict manuel${d.equipes ? "" : ", hors classement"}).`,
    );
  } else {
    const score =
      scoreGagnant != null && finaliste?.score != null ? `, ${scoreGagnant}-${finaliste.score}` : "";
    phrases.push(`${vainqueur} remporte ${d.nom} (${joueurs}) en battant ${finaliste?.pseudo ?? "son adversaire"} en finale${score}.`);
  }

  // 2. Parcours du vainqueur, tour par tour (les exemptions ne comptent pas).
  const parcours = d.matchs
    .filter((m) => m.participants.length === 2 && m.verdict?.gagnantId === vainqueurId && m.tour < dernierTour)
    .sort((a, b) => a.tour - b.tour)
    .map((m) => m.participants.find((p) => p.id !== vainqueurId)?.pseudo ?? "un joueur");
  if (parcours.length > 0) {
    const matchsDuVainqueur = d.matchs.filter(
      (m) => m.participants.length === 2 && m.verdict?.gagnantId === vainqueurId && m.verdict.niveau !== "manuel",
    );
    const sansManchePerdue =
      d.bestOf > 1 &&
      matchsDuVainqueur.length > 0 &&
      matchsDuVainqueur.every((m) => m.participants.find((p) => p.id !== vainqueurId)?.score === 0);
    phrases.push(
      `Son parcours : ${liste([...parcours, finaliste?.pseudo ?? "son adversaire"])}${sansManchePerdue ? ", sans perdre une manche" : ""}.`,
    );
  }

  // 3. Exploit du tournoi : la victoire vérifiée la moins probable.
  if (d.chances) {
    let exploit: { gagnant: string; perdant: string; chances: number; tour: number } | null = null;
    for (const m of d.matchs) {
      if (m.participants.length !== 2 || !m.verdict?.gagnantId || m.verdict.niveau === "manuel") continue;
      const perdant = m.participants.find((p) => p.id !== m.verdict?.gagnantId);
      if (!perdant) continue;
      const p = d.chances(m.verdict.gagnantId, perdant.id);
      if (p < SEUIL_EXPLOIT && (!exploit || p < exploit.chances)) {
        exploit = { gagnant: pseudo(m.verdict.gagnantId), perdant: perdant.pseudo, chances: p, tour: m.tour };
      }
    }
    if (exploit) {
      phrases.push(
        `Exploit du tournoi : ${exploit.gagnant} (${Math.round(exploit.chances * 100)} % de chances estimées) élimine ${exploit.perdant} ${nomTour(exploit.tour, dernierTour)}.`,
      );
    }
  }

  // 4. La preuve : combien de matchs ont été lus chez Riot.
  const joues = d.matchs.filter((m) => m.participants.length === 2 && m.verdict);
  const verifies = joues.filter((m) => m.verdict?.niveau !== "manuel").length;
  if (joues.length > 0) {
    if (verifies === joues.length) {
      phrases.push(
        joues.length > 1
          ? `Les ${joues.length} matchs ont été vérifiés dans la donnée officielle Riot.`
          : "Le match a été vérifié dans la donnée officielle Riot.",
      );
    } else {
      const manuels = joues.length - verifies;
      phrases.push(
        d.equipes
          ? `${verifies} match${verifies > 1 ? "s" : ""} sur ${joues.length} vérifié${verifies > 1 ? "s" : ""} dans la donnée officielle Riot ; ${manuels > 1 ? `les ${manuels} autres ont été tranchés` : "l'autre a été tranché"} à la main.`
          : `${verifies} match${verifies > 1 ? "s" : ""} sur ${joues.length} vérifié${verifies > 1 ? "s" : ""} dans la donnée officielle Riot ; ${manuels > 1 ? `les ${manuels} autres, tranchés` : "l'autre, tranché"} à la main, ne ${manuels > 1 ? "comptent" : "compte"} pas au classement.`,
      );
    }
  }

  return phrases;
}
