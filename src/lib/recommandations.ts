// Recommandations vérifiées (09/10/2026, idée en réserve n°7) : un joueur
// n'en recommande un autre que s'ils ont réellement joué ensemble ou l'un
// contre l'autre une partie lue chez Riot. Règles dans la base
// (recommander, matchs_communs, recommandations_joueur) ; ici, l'affichage.

export const RECOMMANDATION_MIN = 20;
export const RECOMMANDATION_MAX = 500;

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** « 3 matchs vérifiés ensemble · 1 contre », ce qui fonde la recommandation. */
export function libelleMatchsCommuns(ensemble: number, contre: number): string {
  const parties: string[] = [];
  if (ensemble > 0) parties.push(`${pluriel(ensemble, "match")} vérifié${ensemble > 1 ? "s" : ""} ensemble`);
  if (contre > 0) {
    parties.push(
      ensemble > 0 ? `${contre} contre` : `${pluriel(contre, "match")} vérifié${contre > 1 ? "s" : ""} l'un contre l'autre`,
    );
  }
  return parties.join(" · ");
}

const REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi pour recommander un joueur.",
  RECOMMANDATION_SOI_MEME: "Tu ne peux pas te recommander toi-même.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  JOUEUR_INTROUVABLE: "Ce joueur n'existe plus.",
  TEXTE_LONGUEUR: `Ta recommandation doit faire entre ${RECOMMANDATION_MIN} et ${RECOMMANDATION_MAX} caractères.`,
  PAS_JOUE_ENSEMBLE:
    "Seuls les joueurs qui ont joué avec ou contre lui une partie lue chez Riot peuvent le recommander.",
  LIMITE_RECOMMANDATIONS: "Tu as déjà écrit 10 recommandations en 24 heures : réessaie demain.",
  TEXTE_INTERDIT: "Ce texte n'est pas accepté : il contient un terme refusé ou un lien.",
};

export function messageRefusRecommandation(erreur: string): string {
  const code = Object.keys(REFUS).find((c) => erreur.includes(c));
  return code ? REFUS[code] : "Impossible d'enregistrer ta recommandation pour l'instant.";
}
