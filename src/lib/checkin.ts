import type { Statut } from "@/lib/tournois";

// Fenêtre de check-in d'un tournoi (24/09/2026) : ouverte dès l'heure
// prévue, même si la tâche planifiée n'a pas encore fait passer le
// tournoi en statut « checkin » ; fermée dès que le bracket est lancé
// (en cours) ou le tournoi annulé. Partagée par la page tournoi (bouton)
// et lib/checkin-actions.ts (vérification serveur).
export function checkinEstOuvert(statut: Statut, checkinOuvreLe: string, maintenant: Date = new Date()): boolean {
  if (statut === "checkin") return true;
  return statut === "ouvert" && new Date(checkinOuvreLe).getTime() <= maintenant.getTime();
}
