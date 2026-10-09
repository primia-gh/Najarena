// Coach vérifié (09/10/2026, idée en réserve n°8) : un joueur classé
// Diamant ou plus suit des élèves ; leur progression est lue dans le
// registre des points (fonction eleves_coach en base : variations
// « tournoi » pendant le suivi). Logique d'affichage pure, testée dans
// coach.test.ts. Une progression n'est montrée qu'à partir de
// COACH_TOURNOIS_MIN tournois pendant le suivi.

export const COACH_TOURNOIS_MIN = 3;
export const COACH_ELEVES_MAX = 20;

export interface SuiviEleve {
  statut: string;
  tournois: number;
  points: number;
}

export interface ResumeCoach {
  /** Suivis acceptés (en cours ou terminés). */
  suivis: number;
  /** Suivis avec assez de tournois pour mesurer une progression. */
  mesures: number;
  enProgression: number;
  /** Médiane des points gagnés, sur les suivis mesurés (null sans mesure). */
  medianePoints: number | null;
}

export function progressionMesurable(s: SuiviEleve): boolean {
  return s.statut !== "demande" && s.tournois >= COACH_TOURNOIS_MIN;
}

export function resumeCoach(suivis: SuiviEleve[]): ResumeCoach {
  const acceptes = suivis.filter((s) => s.statut !== "demande");
  const points = acceptes
    .filter(progressionMesurable)
    .map((s) => s.points)
    .sort((a, b) => a - b);
  const milieu = Math.floor(points.length / 2);
  return {
    suivis: acceptes.length,
    mesures: points.length,
    enProgression: points.filter((p) => p > 0).length,
    medianePoints:
      points.length === 0
        ? null
        : Math.round(points.length % 2 ? points[milieu] : (points[milieu - 1] + points[milieu]) / 2),
  };
}

/** « +42 » / « −17 » : les points d'un suivi, signe toujours écrit. */
export function formaterPoints(points: number): string {
  const n = Math.round(points);
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

const REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi d'abord.",
  COACH_SOI_MEME: "Tu ne peux pas être ton propre coach.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  COACH_NON_ELIGIBLE: "Ce joueur n'est pas classé Diamant ou plus : il ne peut pas suivre d'élève.",
  SUIVI_EN_COURS: "Tu as déjà un suivi en cours ou demandé : termine-le d'abord.",
  DEMANDE_INTROUVABLE: "Cette demande n'existe plus.",
  LIMITE_ELEVES: `Tu suis déjà ${COACH_ELEVES_MAX} élèves : termine un suivi d'abord.`,
};

export function messageRefusCoach(erreur: string): string {
  const code = Object.keys(REFUS).find((c) => erreur.includes(c));
  return code ? REFUS[code] : "Action impossible pour l'instant.";
}
