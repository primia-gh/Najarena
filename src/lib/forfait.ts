// Forfait automatique (28/09/2026, audit N4) : un joueur qui ne s'est pas
// déclaré prêt 15 minutes après son adversaire perd le match par forfait —
// verdict manuel, aucun point pour personne (CLAUDE.md §4). La base
// applique la même règle (appliquer_forfait_absence, docs/schema.sql) ; ce
// fichier sert à l'affichage et à la tâche de recherche des résultats.
// Garde-fou côté tâche : jamais de forfait si l'un des deux joueurs est en
// partie chez Riot à ce moment-là (il joue sans doute ce match).

export const DELAI_FORFAIT_MINUTES = 15;

export interface ParticipantPret {
  profileId: string;
  pretLe: string | null;
}

/** Le forfait à appliquer maintenant, ou null. */
export function forfaitAAppliquer(
  participants: ParticipantPret[],
  maintenant: Date,
): { absentId: string; presentId: string } | null {
  if (participants.length !== 2) return null;
  const prets = participants.filter((p) => p.pretLe !== null);
  if (prets.length !== 1) return null;
  const present = prets[0];
  const absent = participants.find((p) => p.pretLe === null);
  if (!absent || present.pretLe === null) return null;
  const minutes = (maintenant.getTime() - new Date(present.pretLe).getTime()) / 60000;
  return minutes >= DELAI_FORFAIT_MINUTES ? { absentId: absent.profileId, presentId: present.profileId } : null;
}

/** Heure limite pour se déclarer prêt, une fois l'adversaire prêt. */
export function limiteForfait(pretLeAdversaire: string): Date {
  return new Date(new Date(pretLeAdversaire).getTime() + DELAI_FORFAIT_MINUTES * 60000);
}
