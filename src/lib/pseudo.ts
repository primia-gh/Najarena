// Règles d'un pseudo, partagées par l'inscription et la modification du
// profil (28/09/2026, audit E7). La base applique les mêmes règles
// (docs/schema.sql, modifier_mon_profil) : ce fichier ne sert qu'à afficher
// un message clair avant d'y aller.

export const PSEUDO_REGEX = /^[a-zA-Z0-9 _-]{3,20}$/;

export const MESSAGE_PSEUDO_INVALIDE =
  "Le pseudo doit faire entre 3 et 20 caractères (lettres, chiffres, espaces, - ou _).";

/** Nombre de jours entre deux changements de pseudo (le premier est libre). */
export const DELAI_CHANGEMENT_PSEUDO_JOURS = 30;

// Pseudo donné d'office à un compte créé sans en choisir un (connexion
// Discord) : « Joueur- » suivi de 8 caractères de l'identifiant du compte.
const PSEUDO_AUTOMATIQUE = /^joueur-[0-9a-f]{8}$/i;

export function estPseudoAutomatique(pseudo: string): boolean {
  return PSEUDO_AUTOMATIQUE.test(pseudo);
}

/** Date à partir de laquelle le pseudo peut de nouveau changer (null = maintenant). */
export function prochainChangementPseudo(modifieLe: string | null, maintenant = new Date()): Date | null {
  if (!modifieLe) return null;
  const prochain = new Date(new Date(modifieLe).getTime() + DELAI_CHANGEMENT_PSEUDO_JOURS * 86_400_000);
  return prochain > maintenant ? prochain : null;
}
