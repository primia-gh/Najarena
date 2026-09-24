// Tournois automatiques — ce qu'il faut faire à un instant donné. Logique
// pure : reçoit l'état des tournois, renvoie une liste d'actions, sans
// jamais écrire nulle part (execution.ts les applique). Testée dans
// planification.test.ts, et c'est aussi ce que renvoie la route
// /api/cron/tournois-auto?simulation=1 pour vérifier sans rien modifier.

import type { Statut } from "@/lib/tournois";
import {
  ajouterJours,
  ANNONCE_HEURES_AVANT,
  DERNIER_APPEL_MINUTES,
  instantParis,
  jourParis,
  JOURS_D_AVANCE,
  RETARD_MAX_DEMARRAGE_MINUTES,
  type Creneau,
} from "./creneaux";

// annonce : salon Discord (tournois automatiques) ; checkin_ouvert et
// dernier_appel : joueurs inscrits qui n'ont pas encore fait leur check-in.
export type TypeRappel = "annonce" | "checkin_ouvert" | "dernier_appel";

export interface TournoiSuivi {
  id: string;
  statut: Statut;
  debute_le: string;
  checkin_ouvre_le: string;
  creneau_auto: string | null;
  rappels: TypeRappel[];
}

export type Action =
  | { type: "creer"; creneau: string; jour: string; debuteLe: string; checkinOuvreLe: string }
  | { type: "ouvrir_checkin"; tournoiId: string }
  | { type: "rappel"; tournoiId: string; rappel: TypeRappel }
  | { type: "demarrer"; tournoiId: string }
  | { type: "annuler_retard"; tournoiId: string };

const MINUTE = 60_000;

// Deux rappels n'ont de sens que si le check-in dure assez longtemps pour
// les espacer ; sinon, le premier suffit.
const ECART_MIN_ENTRE_RAPPELS_MINUTES = 5;

export function planifier(
  maintenant: Date,
  tournois: TournoiSuivi[],
  creneaux: readonly Creneau[],
): Action[] {
  const actions: Action[] = [];
  const t = maintenant.getTime();

  // 1. Création des prochains tournois de chaque créneau.
  const aujourdhui = jourParis(maintenant);
  for (const creneau of creneaux) {
    for (let decalage = 0; decalage < JOURS_D_AVANCE; decalage++) {
      const jour = ajouterJours(aujourdhui, decalage);
      const debut = instantParis(jour, creneau.heure);
      const checkin = new Date(debut.getTime() - creneau.checkinMinutes * MINUTE);
      // Jamais un tournoi dont le check-in est déjà ouvert : personne
      // n'aurait eu le temps de s'inscrire, il serait annulé aussitôt.
      if (checkin.getTime() <= t) continue;
      const existe = tournois.some(
        (x) => x.creneau_auto === creneau.cle && new Date(x.debute_le).getTime() === debut.getTime(),
      );
      if (!existe) {
        actions.push({
          type: "creer",
          creneau: creneau.cle,
          jour,
          debuteLe: debut.toISOString(),
          checkinOuvreLe: checkin.toISOString(),
        });
      }
    }
  }

  // 2. Cycle de vie des tournois publiés, qu'ils soient automatiques ou
  // créés par un organisateur — sauf le démarrage, réservé aux tournois
  // automatiques (un organisateur lance lui-même son bracket).
  for (const tournoi of tournois) {
    if (tournoi.statut !== "ouvert" && tournoi.statut !== "checkin") continue;

    const debut = new Date(tournoi.debute_le).getTime();
    const ouvertureCheckin = new Date(tournoi.checkin_ouvre_le).getTime();
    const estAutomatique = tournoi.creneau_auto !== null;

    if (estAutomatique && t >= debut) {
      actions.push(
        t > debut + RETARD_MAX_DEMARRAGE_MINUTES * MINUTE
          ? { type: "annuler_retard", tournoiId: tournoi.id }
          : { type: "demarrer", tournoiId: tournoi.id },
      );
      continue;
    }

    if (t < ouvertureCheckin) {
      const annonce = debut - ANNONCE_HEURES_AVANT * 60 * MINUTE;
      if (estAutomatique && t >= annonce && !tournoi.rappels.includes("annonce")) {
        actions.push({ type: "rappel", tournoiId: tournoi.id, rappel: "annonce" });
      }
      continue;
    }

    if (tournoi.statut === "ouvert") {
      actions.push({ type: "ouvrir_checkin", tournoiId: tournoi.id });
    }

    // Les rappels ne partent qu'avant l'heure du début : un rappel de
    // check-in reçu après coup ne servirait à rien.
    if (t >= debut) continue;

    const dernierAppel = debut - DERNIER_APPEL_MINUTES * MINUTE;
    const checkinAssezLong =
      dernierAppel - ouvertureCheckin >= ECART_MIN_ENTRE_RAPPELS_MINUTES * MINUTE;

    // Une fois dans la fenêtre du dernier appel, seul celui-ci part — même
    // si le premier rappel a été manqué (tâche planifiée en retard) : un
    // joueur ne reçoit jamais deux rappels coup sur coup.
    if (checkinAssezLong && t >= dernierAppel) {
      if (!tournoi.rappels.includes("dernier_appel")) {
        actions.push({ type: "rappel", tournoiId: tournoi.id, rappel: "dernier_appel" });
      }
    } else if (!tournoi.rappels.includes("checkin_ouvert")) {
      actions.push({ type: "rappel", tournoiId: tournoi.id, rappel: "checkin_ouvert" });
    }
  }

  return actions;
}
