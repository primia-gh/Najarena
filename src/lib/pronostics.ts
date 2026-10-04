// Pronostics gratuits (03/10/2026, audit N20) : le vainqueur des
// demi-finales (1 point) et de la finale (2 points) des tournois en cours.
// Aucune mise, aucun gain. La base applique les règles (pronostiquer,
// classement_pronostics, docs/schema.sql) ; ce fichier les reprend pour
// l'affichage.

export const DELAI_PRONOSTIC_MINUTES = 10;

/** Points d'un pronostic juste : 2 en finale, 1 en demi-finale, 0 avant. Même règle que public.points_pronostic. */
export function pointsPronostic(tour: number, capacite: number): number {
  if (capacite < 4) return 0;
  const nbTours = Math.round(Math.log2(capacite));
  if (tour === nbTours) return 2;
  if (tour === nbTours - 1) return 1;
  return 0;
}

export interface MatchPronostiquable {
  statutTournoi: string;
  statutMatch: string;
  demarreLe: string | null;
  nbParticipants: number;
  unJoueurPret: boolean;
  aUnVerdict: boolean;
}

/** Le match accepte-t-il encore des pronostics ? */
export function pronosticOuvert(m: MatchPronostiquable, maintenant: Date): boolean {
  if (m.statutTournoi !== "en_cours" || m.nbParticipants !== 2 || m.unJoueurPret || m.aUnVerdict) return false;
  if (m.statutMatch !== "en_attente" && m.statutMatch !== "en_cours") return false;
  if (!m.demarreLe) return true;
  return maintenant.getTime() - new Date(m.demarreLe).getTime() <= DELAI_PRONOSTIC_MINUTES * 60_000;
}

/** Parts en pour cent (somme 100), [0, 0] sans pronostic. */
export function partsPronostics(a: number, b: number): [number, number] {
  const total = a + b;
  if (total === 0) return [0, 0];
  const pa = Math.round((a / total) * 100);
  return [pa, 100 - pa];
}

export type IssuePronostic = "en_attente" | "juste" | "faux" | "annule";

/**
 * Issue d'un pronostic : compté seulement sur un résultat lu chez Riot ; un
 * forfait ou une décision manuelle l'annule (rien ne s'invente).
 */
export function issuePronostic(
  prevu: string,
  verdict: { niveau: string; gagnantId: string | null } | null,
): IssuePronostic {
  if (!verdict) return "en_attente";
  if (verdict.niveau === "manuel" || !verdict.gagnantId) return "annule";
  return verdict.gagnantId === prevu ? "juste" : "faux";
}

export const LIBELLE_ISSUE: Record<IssuePronostic, string> = {
  en_attente: "En attente du résultat",
  juste: "Juste",
  faux: "Raté",
  annule: "Annulé (résultat non lu chez Riot)",
};

const MESSAGES_REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi pour pronostiquer.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : impossible de pronostiquer.",
  MATCH_INTROUVABLE: "Ce match n'existe pas.",
  PRONOSTIC_HORS_PHASE: "On ne pronostique que les demi-finales et la finale.",
  JOUEUR_DU_TOURNOI: "Les joueurs du tournoi et son organisateur ne pronostiquent pas.",
  CHOIX_INVALIDE: "Ce joueur ne dispute pas ce match.",
  PRONOSTIC_FERME: "Les pronostics de ce match sont fermés : il a commencé.",
};

export function messageRefusPronostic(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS[code] : parDefaut;
}
