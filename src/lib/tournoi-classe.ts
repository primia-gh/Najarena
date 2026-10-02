// Tournoi classé (28/09/2026, audit E12 et N12) : les critères publics qui
// décident si un tournoi compte au classement. La base applique les mêmes
// (criteres_tournoi_classe, docs/schema.sql) et fige la décision à la
// clôture (tournaments.classe) ; ce fichier ne sert qu'à l'affichage.
// Changer un seuil ici impose de le changer aussi dans la base.

export const JOUEURS_MIN_TOURNOI_CLASSE = 8;
export const PREAVIS_TOURNOI_CLASSE_HEURES = 24;

export interface DonneesClassement {
  /** Tournoi quotidien créé par Najarena (tournois automatiques). */
  officiel: boolean;
  /** Déclaré amical par son organisateur (compte_pour_classement = false). */
  amical: boolean;
  /** Ouverture des inscriptions ; nul pour un brouillon. */
  publieLe: string | null;
  debuteLe: string;
  /** Joueurs placés dans le bracket ; nul tant qu'il n'est pas généré. */
  joueursAuDepart: number | null;
  /** Inscriptions actives, pour l'estimation avant le bracket. */
  inscrits: number;
  /** L'organisateur est inscrit (actif) ou placé dans le bracket. */
  organisateurJoue: boolean;
  /** Décision figée à la clôture ; nulle avant. */
  decision: boolean | null;
}

export type EtatCritere = "ok" | "ko" | "attente";

export interface CritereClassement {
  libelle: string;
  etat: EtatCritere;
  detail: string | null;
}

export type StatutClassement = "classe" | "non_classe" | "a_confirmer";

export interface EvaluationClassement {
  statut: StatutClassement;
  titre: string;
  explication: string;
  criteres: CritereClassement[];
}

const HEURE_MS = 60 * 60 * 1000;

export function publieATemps(publieLe: string | null, debuteLe: string): boolean | null {
  if (!publieLe) return null;
  return new Date(debuteLe).getTime() - new Date(publieLe).getTime() >= PREAVIS_TOURNOI_CLASSE_HEURES * HEURE_MS;
}

export function criteresClassement(d: DonneesClassement): CritereClassement[] {
  if (d.officiel) {
    return [
      {
        libelle: "Tournoi officiel Najarena, ouvert à tous",
        etat: d.amical ? "ko" : "ok",
        detail: null,
      },
    ];
  }

  const aTemps = publieATemps(d.publieLe, d.debuteLe);
  return [
    {
      libelle: `Publié au moins ${PREAVIS_TOURNOI_CLASSE_HEURES} h avant le début`,
      etat: aTemps === null ? "attente" : aTemps ? "ok" : "ko",
      detail: aTemps === null ? "Pas encore publié." : null,
    },
    {
      libelle: `Au moins ${JOUEURS_MIN_TOURNOI_CLASSE} joueurs au départ`,
      etat:
        d.joueursAuDepart === null
          ? "attente"
          : d.joueursAuDepart >= JOUEURS_MIN_TOURNOI_CLASSE
            ? "ok"
            : "ko",
      detail:
        d.joueursAuDepart === null
          ? `${d.inscrits} inscrit${d.inscrits > 1 ? "s" : ""} pour l'instant.`
          : `${d.joueursAuDepart} joueur${d.joueursAuDepart > 1 ? "s" : ""} au départ.`,
    },
    {
      libelle: "L'organisateur ne joue pas dans son tournoi",
      etat: d.organisateurJoue ? "ko" : "ok",
      detail: null,
    },
    {
      libelle: "Pas déclaré amical par l'organisateur",
      etat: d.amical ? "ko" : "ok",
      detail: null,
    },
  ];
}

export function evaluerClassement(d: DonneesClassement): EvaluationClassement {
  const criteres = criteresClassement(d);

  if (d.decision === true) {
    return {
      statut: "classe",
      titre: "Tournoi classé",
      explication: "Les matchs vérifiés de ce tournoi ont compté au classement.",
      criteres,
    };
  }
  if (d.decision === false) {
    return {
      statut: "non_classe",
      titre: "Tournoi non classé",
      explication: d.amical
        ? "Tournoi amical : aucun point n'était en jeu."
        : "Ce tournoi ne remplissait pas les critères publics : il n'a pas compté au classement.",
      criteres,
    };
  }

  if (d.amical) {
    return {
      statut: "non_classe",
      titre: "Tournoi amical",
      explication: "Déclaré amical par son organisateur : aucun point de classement en jeu.",
      criteres,
    };
  }

  if (criteres.some((c) => c.etat === "ko")) {
    return {
      statut: "non_classe",
      titre: "Tournoi non classé",
      explication: "Il ne remplit pas tous les critères publics : ses matchs ne comptent pas au classement.",
      criteres,
    };
  }

  if (criteres.some((c) => c.etat === "attente")) {
    return {
      statut: "a_confirmer",
      titre: "Classement à confirmer",
      explication: `Il comptera au classement si au moins ${JOUEURS_MIN_TOURNOI_CLASSE} joueurs prennent le départ.`,
      criteres,
    };
  }

  return {
    statut: "classe",
    titre: "Tournoi classé",
    explication: d.officiel
      ? "Tournoi officiel : ses matchs vérifiés comptent au classement."
      : "Il remplit les critères publics : ses matchs vérifiés comptent au classement.",
    criteres,
  };
}

/** Valeur courte de l'encart « En jeu » de la page tournoi. */
export function libelleEnJeu(statut: StatutClassement, amical: boolean): string {
  if (statut === "classe") return "Points de classement";
  if (statut === "a_confirmer") return "Classement à confirmer";
  return amical ? "Match amical" : "Aucun point";
}
