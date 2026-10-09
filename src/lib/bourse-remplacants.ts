// Bourse aux remplaçants (09/10/2026, idée en réserve n°15) : dans un
// tournoi 5v5, un joueur vérifié se déclare disponible ; jusqu'au lancement
// du bracket, un capitaine remplace un de ses alignés par lui (aligné
// temporaire). Règles dans la base (proposer_remplacement,
// remplacer_aligne) ; ici, les messages.

export const REMPLACANTS_MAX_PAR_EQUIPE = 2;

const REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi d'abord.",
  TOURNOI_INTROUVABLE: "Ce tournoi n'existe plus.",
  TOURNOI_EN_SOLO: "La bourse aux remplaçants ne concerne que les tournois 5v5.",
  ALIGNEMENT_FIGE: "Le bracket est lancé : les alignements ne changent plus.",
  ROLE_INVALIDE: "Choisis un rôle de la liste.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  COMPTE_RIOT_REQUIS: "Il faut un compte Riot vérifié pour jouer : lie le tien d'abord.",
  REGION_DIFFERENTE: "Ton compte Riot n'est pas sur la région de ce tournoi.",
  DEJA_DANS_UNE_EQUIPE: "Tu es déjà aligné dans une équipe de ce tournoi.",
  RESERVE_MEMBRES: "Ce tournoi est réservé aux membres de sa communauté.",
  EQUIPE_NON_INSCRITE: "Seul le capitaine d'une équipe inscrite peut faire un remplacement.",
  REMPLACER_CAPITAINE: "Le capitaine représente l'équipe : il ne peut pas être remplacé.",
  JOUEUR_NON_ALIGNE: "Ce joueur n'est pas dans ton alignement.",
  REMPLACANT_INDISPONIBLE: "Ce joueur n'est plus dans la bourse.",
  JOUEUR_DEJA_ALIGNE: "Ce joueur vient d'être pris par une autre équipe.",
  ALIGNEMENT_SUSPENDU: "Ce joueur est suspendu.",
  ALIGNEMENT_COMPTE_RIOT: "Ce joueur n'a plus de compte Riot vérifié sur la région du tournoi.",
  LIMITE_REMPLACANTS: `Au plus ${REMPLACANTS_MAX_PAR_EQUIPE} remplaçants par équipe et par tournoi.`,
};

export function messageRefusBourse(erreur: string): string {
  const code = Object.keys(REFUS).find((c) => erreur.includes(c));
  return code ? REFUS[code] : "Action impossible pour l'instant.";
}
