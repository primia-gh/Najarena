// Chronomètre de la salle de match (audit N1) : il part quand les deux
// joueurs (ou les deux équipes) se sont déclarés prêts. Logique pure,
// testée dans chrono-match.test.ts ; affichée par ChronoMatch.

/** Le chrono part à la plus tardive des deux déclarations « prêt ». */
export function debutChrono(pret: { moi: string | null; adversaire: string | null }): string | null {
  if (!pret.moi || !pret.adversaire) return null;
  return new Date(pret.moi).getTime() >= new Date(pret.adversaire).getTime() ? pret.moi : pret.adversaire;
}

/** Temps écoulé depuis `depuis` : « 12:05 », ou « 1:02:05 » au-delà d'une heure. Jamais négatif. */
export function formaterChrono(depuis: string, maintenant: number): string {
  const secondes = Math.max(0, Math.floor((maintenant - new Date(depuis).getTime()) / 1000));
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  const reste = String(secondes % 60).padStart(2, "0");
  return heures > 0 ? `${heures}:${String(minutes).padStart(2, "0")}:${reste}` : `${minutes}:${reste}`;
}
