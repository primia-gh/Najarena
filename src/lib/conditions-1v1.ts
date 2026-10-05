// Conditions de victoire du 1v1 classique (28/09/2026, audit N5) : le
// premier qui obtient le premier sang, détruit la première tour ou atteint
// 100 sbires gagne — sans avoir à aller jusqu'au Nexus. Lues dans la
// chronologie Riot de la partie (match-v5 timeline), jamais déclarées par
// les joueurs. On n'invente jamais un vainqueur : si deux conditions
// remplies par des joueurs différents tombent dans la même minute de
// chronologie (les sbires n'y sont comptés qu'une fois par minute), on ne
// peut pas dire laquelle est la première — la partie n'est pas retenue et
// l'organisateur tranche (CLAUDE.md §3).

export type ConditionVictoire = "nexus" | "classique";

export const CONDITIONS_VICTOIRE: { valeur: ConditionVictoire; libelle: string }[] = [
  { valeur: "nexus", libelle: "Destruction du Nexus (ou abandon du perdant)" },
  { valeur: "classique", libelle: "1v1 classique : premier sang, première tour ou 100 sbires" },
];

export const SBIRES_VICTOIRE = 100;

export interface EvenementChronologie {
  type: string;
  timestamp: number;
  killerId?: number;
  victimId?: number;
  buildingType?: string;
  /** BUILDING_KILL : équipe à qui appartenait le bâtiment détruit. */
  teamId?: number;
  /** CHAMPION_KILL : lieu de la mort, en coordonnées de la carte. */
  position?: { x: number; y: number };
}

export interface ImageChronologie {
  timestamp: number;
  participantFrames?: Record<string, { minionsKilled?: number; totalGold?: number }>;
  events?: EvenementChronologie[];
}

export interface ChronologieRiot {
  info: {
    frames: ImageChronologie[];
    participants?: { participantId: number; puuid: string }[];
  };
}

export type NomCondition = "premier_sang" | "premiere_tour" | "sbires";

export type IssueClassique = { vainqueur: "A" | "B"; condition: NomCondition } | "ambigu" | null;

interface ConditionRemplie {
  nom: NomCondition;
  vainqueur: "A" | "B";
  /** Plus tôt possible (exclu pour les sbires : franchi après l'image précédente). */
  debut: number;
  debutExclusif: boolean;
  /** Plus tard possible. */
  fin: number;
}

export interface JoueurChronologie {
  participantId: number;
  /** 100 ou 200. */
  equipe: number;
}

/**
 * Vainqueur d'une partie au 1v1 classique, ou « ambigu » si l'ordre des
 * conditions ne peut pas être établi, ou null si aucune n'est remplie.
 */
export function vainqueurClassique(
  chronologie: ChronologieRiot,
  joueurA: JoueurChronologie,
  joueurB: JoueurChronologie,
): IssueClassique {
  const images = chronologie.info.frames;
  const evenements = images.flatMap((i) => i.events ?? []).sort((a, b) => a.timestamp - b.timestamp);
  const conditions: ConditionRemplie[] = [];

  // Premier sang : la première mort de l'un des deux, quel qu'en soit
  // l'auteur (tour, sbires) — l'autre joueur gagne.
  const mort = evenements.find(
    (e) =>
      e.type === "CHAMPION_KILL" && (e.victimId === joueurA.participantId || e.victimId === joueurB.participantId),
  );
  if (mort) {
    conditions.push({
      nom: "premier_sang",
      vainqueur: mort.victimId === joueurA.participantId ? "B" : "A",
      debut: mort.timestamp,
      debutExclusif: false,
      fin: mort.timestamp,
    });
  }

  // Première tour : la première tour détruite, par qui que ce soit — son
  // propriétaire perd.
  const tour = evenements.find(
    (e) =>
      e.type === "BUILDING_KILL" &&
      e.buildingType === "TOWER_BUILDING" &&
      (e.teamId === joueurA.equipe || e.teamId === joueurB.equipe),
  );
  if (tour) {
    conditions.push({
      nom: "premiere_tour",
      vainqueur: tour.teamId === joueurA.equipe ? "B" : "A",
      debut: tour.timestamp,
      debutExclusif: false,
      fin: tour.timestamp,
    });
  }

  // 100 sbires : franchi entre l'image précédente (exclue) et la première
  // image où le compteur l'atteint.
  for (const [cote, joueur] of [
    ["A", joueurA],
    ["B", joueurB],
  ] as const) {
    const index = images.findIndex(
      (i) => (i.participantFrames?.[String(joueur.participantId)]?.minionsKilled ?? 0) >= SBIRES_VICTOIRE,
    );
    if (index >= 0) {
      conditions.push({
        nom: "sbires",
        vainqueur: cote,
        debut: index > 0 ? images[index - 1].timestamp : images[index].timestamp,
        debutExclusif: index > 0,
        fin: images[index].timestamp,
      });
    }
  }

  if (conditions.length === 0) return null;

  const premiere = conditions.reduce((a, b) => (b.fin < a.fin ? b : a));
  const peutEtreAvant = conditions.filter(
    (c) => c !== premiere && (c.debutExclusif ? c.debut < premiere.fin : c.debut <= premiere.fin),
  );
  if (peutEtreAvant.some((c) => c.vainqueur !== premiere.vainqueur)) return "ambigu";
  return { vainqueur: premiere.vainqueur, condition: premiere.nom };
}
