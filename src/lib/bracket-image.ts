// Bracket de l'image de partage d'un tournoi (audit N7) : les trois
// derniers tours au plus (quarts, demies, finale), placés au pixel près —
// le générateur d'images ne connaît ni la grille ni les connecteurs du
// site. Logique pure, testée dans bracket-image.test.ts.

export interface MatchImage {
  tour: number;
  position: number;
  /** Joueurs (ou équipes) des places 1 et 2 ; nul tant que la place est vide. */
  joueurs: [string | null, string | null];
  /** Place du vainqueur (0 ou 1), nulle tant que le match n'est pas décidé. */
  gagnant: 0 | 1 | null;
}

export interface BoiteBracket {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  match: MatchImage;
}

/** Trait de connexion, dessiné comme un rectangle fin. */
export interface TraitBracket {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface ColonneBracket {
  tour: number;
  x: number;
  libelle: string;
}

export const TOURS_AFFICHES = 3;
const EPAISSEUR = 2;
/** Une case ne s'étire pas au-delà : un duel ne traverse pas toute l'image. */
const LARGEUR_CASE_MAX = 240;

/** Nom d'un tour d'après sa distance à la finale. */
export function libelleTour(tour: number, dernierTour: number): string {
  const avantFinale = dernierTour - tour;
  if (avantFinale === 0) return "FINALE";
  if (avantFinale === 1) return "DEMI-FINALES";
  if (avantFinale === 2) return "QUARTS";
  return `TOUR ${tour}`;
}

/** Coupe un nom trop long pour sa case, avec des points de suspension. */
export function tronquer(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function disposerBracket(
  matchs: MatchImage[],
  largeur: number,
  hauteur: number,
  ecart = 28,
): { boites: BoiteBracket[]; traits: TraitBracket[]; colonnes: ColonneBracket[] } {
  const dernierTour = Math.max(0, ...matchs.map((m) => m.tour));
  if (dernierTour === 0) return { boites: [], traits: [], colonnes: [] };

  const premierTour = Math.max(1, dernierTour - TOURS_AFFICHES + 1);
  const nbColonnes = dernierTour - premierTour + 1;
  const largeurColonne = Math.min(LARGEUR_CASE_MAX, (largeur - (nbColonnes - 1) * ecart) / nbColonnes);
  const matchsPremierTour = 2 ** (dernierTour - premierTour);
  const hauteurBoite = Math.min(64, hauteur / matchsPremierTour - 12);

  const colonne = (tour: number) => tour - premierTour;
  const xColonne = (tour: number) => colonne(tour) * (largeurColonne + ecart);
  const centre = (tour: number, position: number) => {
    const places = 2 ** (dernierTour - tour);
    return ((position - 0.5) * hauteur) / places;
  };
  const existe = new Set(matchs.map((m) => `${m.tour}-${m.position}`));

  const boites: BoiteBracket[] = matchs
    .filter((m) => m.tour >= premierTour && m.position >= 1 && m.position <= 2 ** (dernierTour - m.tour))
    .sort((a, b) => a.tour - b.tour || a.position - b.position)
    .map((m) => ({
      x: xColonne(m.tour),
      y: centre(m.tour, m.position) - hauteurBoite / 2,
      largeur: largeurColonne,
      hauteur: hauteurBoite,
      match: m,
    }));

  // Connecteurs : de chaque match vers le match suivant (tour + 1,
  // position arrondie au-dessus de la moitié).
  const traits: TraitBracket[] = [];
  for (const b of boites) {
    const { tour, position } = b.match;
    if (tour === dernierTour) continue;
    const suivant = Math.ceil(position / 2);
    if (!existe.has(`${tour + 1}-${suivant}`)) continue;
    const xMilieu = b.x + largeurColonne + ecart / 2;
    const yDepart = centre(tour, position);
    const yArrivee = centre(tour + 1, suivant);
    traits.push({ x: b.x + largeurColonne, y: yDepart - EPAISSEUR / 2, largeur: ecart / 2, hauteur: EPAISSEUR });
    traits.push({
      x: xMilieu - EPAISSEUR / 2,
      y: Math.min(yDepart, yArrivee) - EPAISSEUR / 2,
      largeur: EPAISSEUR,
      hauteur: Math.abs(yArrivee - yDepart) + EPAISSEUR,
    });
    // Le trait d'arrivée, une seule fois par match suivant (depuis la
    // place impaire, ou depuis la paire si la place impaire est vide).
    if (position % 2 === 1 || !existe.has(`${tour}-${position - 1}`)) {
      traits.push({ x: xMilieu, y: yArrivee - EPAISSEUR / 2, largeur: ecart / 2, hauteur: EPAISSEUR });
    }
  }

  const colonnes: ColonneBracket[] = [];
  for (let tour = premierTour; tour <= dernierTour; tour++) {
    colonnes.push({ tour, x: xColonne(tour), libelle: libelleTour(tour, dernierTour) });
  }
  return { boites, traits, colonnes };
}
