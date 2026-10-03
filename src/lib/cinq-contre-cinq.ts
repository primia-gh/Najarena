// Tournois 5v5 (03/10/2026, audit N21) — logique pure, sans réseau ni
// base : quelle partie Riot vaut résultat d'un match d'équipes, et comment
// nommer une équipe dans le bracket. Règles en base : docs/schema.sql,
// section « Tournois 5v5 » (s_inscrire_equipe, alignements).

import type { ParticipantMatchRiot } from "@/lib/riot";

/** Joueurs alignés par équipe, capitaine compris. */
export const TAILLE_ALIGNEMENT = 5;

/** puuid des cinq joueurs alignés de chaque équipe (capitaine compris). */
export interface Alignements {
  a: string[];
  b: string[];
}

/**
 * Une partie personnalisée vaut résultat d'un match 5v5 si elle compte dix
 * joueurs, que les cinq joueurs alignés de chaque équipe y figurent, tous
 * du même côté, et les deux équipes face à face. Un remplaçant non inscrit
 * ou un joueur passé dans l'autre camp : partie non retenue, jamais un
 * résultat deviné (l'organisateur tranche).
 */
export function alignementsDansLaPartie(participants: ParticipantMatchRiot[], alignements: Alignements): boolean {
  if (participants.length !== 2 * TAILLE_ALIGNEMENT) return false;
  if (alignements.a.length !== TAILLE_ALIGNEMENT || alignements.b.length !== TAILLE_ALIGNEMENT) return false;

  const parPuuid = new Map(participants.map((p) => [p.puuid, p]));
  // Camp d'un joueur : teamId (100 / 200) quand Riot le donne, sinon
  // l'issue de la partie (tout un camp gagne ou perd ensemble).
  const camp = (p: ParticipantMatchRiot) =>
    p.teamId !== undefined ? `equipe-${p.teamId}` : p.win ? "victoire" : "defaite";
  const campUnique = (puuids: string[]): string | null => {
    const camps = new Set<string>();
    for (const puuid of puuids) {
      const p = parPuuid.get(puuid);
      if (!p) return null;
      camps.add(camp(p));
    }
    return camps.size === 1 ? [...camps][0] : null;
  };

  const campA = campUnique(alignements.a);
  const campB = campUnique(alignements.b);
  return campA !== null && campB !== null && campA !== campB;
}

/** « [TAG] Nom » : l'équipe telle qu'affichée dans le bracket. */
export function libelleEquipe(tag: string | null | undefined, nom: string | null | undefined): string {
  if (!nom) return "Équipe inconnue";
  return tag ? `[${tag}] ${nom}` : nom;
}

/**
 * Membres qu'un capitaine peut aligner : membres acceptés de l'équipe,
 * capitaine en tête. Ceux sans compte Riot vérifié dans la région du
 * tournoi sont signalés (la base les refuse).
 */
export function membresAlignables<M extends { profileId: string; accepte: boolean }>(
  membres: M[],
  capitaineId: string,
): M[] {
  return membres
    .filter((m) => m.accepte)
    .sort((x, y) => (x.profileId === capitaineId ? -1 : y.profileId === capitaineId ? 1 : 0));
}

export interface MatchDuParcours {
  tour: number;
  /** null : pas encore décidé. */
  estGagnant: boolean | null;
  /** Verdict lu chez Riot (niveaux 2 et 3), jamais un verdict manuel. */
  verifie: boolean;
}

/**
 * Parcours d'une équipe dans un tournoi, pour son palmarès : où elle s'est
 * arrêtée, et combien de victoires ont été lues chez Riot. Uniquement ce
 * que le bracket dit — jamais de classement d'équipe inventé.
 */
export function parcoursDansTournoi(d: { statut: string; capacite: number; matchs: MatchDuParcours[] }): {
  libelle: string;
  victoiresVerifiees: number;
} {
  const victoiresVerifiees = d.matchs.filter((m) => m.estGagnant === true && m.verifie).length;
  if (d.statut === "annule") return { libelle: "Tournoi annulé", victoiresVerifiees };
  if (d.matchs.length === 0) {
    return {
      libelle: ["brouillon", "ouvert", "checkin"].includes(d.statut) ? "Inscrite" : "Hors du bracket",
      victoiresVerifiees,
    };
  }

  const nbTours = Math.round(Math.log2(d.capacite));
  const defaite = d.matchs.find((m) => m.estGagnant === false);
  if (defaite) {
    const reste = nbTours - defaite.tour + 1;
    const libelle =
      reste === 1
        ? "Finaliste"
        : reste === 2
          ? "Demi-finaliste"
          : reste === 3
            ? "Quart de finaliste"
            : `Éliminée au tour ${defaite.tour}`;
    return { libelle, victoiresVerifiees };
  }
  if (d.matchs.some((m) => m.tour === nbTours && m.estGagnant === true)) {
    return { libelle: "Vainqueur", victoiresVerifiees };
  }
  return { libelle: d.statut === "en_cours" ? "En lice" : "Hors du bracket", victoiresVerifiees };
}
