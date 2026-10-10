// Modération automatique (02/10/2026, audit N27) : la base analyse chaque
// texte saisi par un joueur (analyser_texte, docs/schema.sql) et refuse ce
// qui ne peut pas être publié. Ce fichier traduit ses refus pour les
// formulaires.

const MESSAGES: Record<string, string> = {
  PSEUDO_INTERDIT:
    "Ce pseudo n'est pas accepté : il contient un terme refusé (insulte, propos haineux) ou laisse croire à un compte officiel (Najarena, admin, modo, Riot…).",
  NOM_INTERDIT:
    "Ce nom n'est pas accepté : il contient un terme refusé, un lien, ou laisse croire à quelque chose d'officiel (Najarena, admin, Riot…).",
  TEXTE_INTERDIT: "Ce texte n'est pas accepté : il contient un terme refusé ou un lien.",
  MESSAGE_INTERDIT: "Message refusé : propos haineux ou tentative d'arnaque.",
  MOTIF_INTERDIT: "Motif refusé : propos haineux. Décris simplement ce qui ne va pas dans le résultat.",
  // Limites d'usage (audit sécurité du 10/10/2026, consommer_limite) :
  // 5 tournois par 24 h, 10 litiges par 24 h, 30 messages par heure,
  // 10 liaisons Riot par heure.
  LIMITE_ATTEINTE: "Trop de demandes en peu de temps : réessaie un peu plus tard.",
};

/** Message lisible si l'erreur de la base vient de la modération, sinon nul. */
export function messageModeration(erreur: string | undefined | null): string | null {
  if (!erreur) return null;
  const code = Object.keys(MESSAGES).find((c) => erreur.includes(c));
  return code ? MESSAGES[code] : null;
}

/** Texte affiché à l'auteur d'un message retenu pour relecture. */
export const MESSAGE_EN_REVUE =
  "Ton message sera remis après relecture par un modérateur : il contient un terme ou un lien à vérifier.";

export const LIBELLE_RAISON: Record<string, string> = {
  insulte: "Insulte",
  menace: "Menace",
  lien: "Lien",
  haine: "Propos haineux",
  arnaque: "Arnaque",
  grossier: "Grossièreté",
  usurpation: "Usurpation",
};
