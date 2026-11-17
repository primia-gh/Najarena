// Bilan d'exemple de /lol/bilan : un joueur fictif (TON_PSEUDO), des
// parties et des repères fictifs, jamais écrits en base — comme le tournoi
// d'exemple (/lol/tournois/demo). Calculé par les mêmes fonctions que le
// vrai bilan (src/lib/bilan.ts) : ce que montre l'exemple est exactement
// ce que voit un joueur. Tirage pseudo-aléatoire à graine fixe : la page
// est identique à chaque affichage.

import {
  construireBilan,
  construireBuild,
  LIBELLE_POSTE,
  partieClasseeDepuisLigne,
  type Bilan,
  type BuildChampion,
  type LigneIndicateursClassees,
  type LigneReperesBuild,
  type PartieBilan,
  type Repere,
} from "./bilan";
import { libelleRang } from "./analyse-classees";
import { positionsNiveau, type PositionNiveau } from "./niveau-classees";
import { sangFroid, type SangFroid } from "./sang-froid";
import { hygieneDeJeu, type Hygiene } from "./hygiene-jeu";
import { carteDesMorts, TAILLE_CARTE, type CarteMorts } from "./carte-morts";

export const PSEUDO_EXEMPLE = "TON_PSEUDO";

/** Générateur à graine fixe (mulberry32). */
function generateur(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hasard = generateur(20261005);
const autour = (centre: number, ecart: number) => centre + (hasard() * 2 - 1) * ecart;
const arrondi = (v: number, decimales: number) => Math.round(v * 10 ** decimales) / 10 ** decimales;

interface ModeleChampion {
  champion: string;
  championId: number;
  objets: [number, number][]; // objet, probabilité de l'avoir en fin de partie
  runes: [number, number][]; // rune principale, probabilité cumulée
  sorts: number[];
}

const AHRI: ModeleChampion = {
  champion: "Ahri",
  championId: 103,
  objets: [
    [6655, 0.9],
    [3020, 1],
    [3157, 0.4],
    [4645, 0.25],
    [3089, 0.1],
  ],
  runes: [
    [8112, 0.8],
    [8229, 1],
  ],
  sorts: [4, 14],
};
const ZED: ModeleChampion = {
  champion: "Zed",
  championId: 238,
  objets: [
    [3142, 1],
    [3158, 0.75],
    [6692, 0.6],
    [3814, 0.3],
    [6694, 0.1],
  ],
  runes: [
    [8010, 0.6],
    [8112, 1],
  ],
  sorts: [4, 14],
};
const YASUO: ModeleChampion = {
  champion: "Yasuo",
  championId: 157,
  objets: [
    [3031, 1],
    [3006, 0.85],
    [6673, 0.7],
    [3072, 0.35],
  ],
  runes: [[8008, 1]],
  sorts: [4, 14],
};

// 24 parties au 1v1, du 6 septembre au 4 octobre 2026 : le farm progresse,
// les dégâts sont bons, les morts rares, le premier sang moyen.
const ORDRE: ModeleChampion[] = [
  AHRI, ZED, AHRI, YASUO, AHRI, ZED, YASUO, AHRI, ZED, AHRI, YASUO, ZED,
  AHRI, ZED, YASUO, AHRI, ZED, AHRI, YASUO, ZED, AHRI, YASUO, ZED, AHRI,
];
const VICTOIRES = [0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1];

function partieExemple(modele: ModeleChampion, i: number): PartieBilan {
  const progression = i / (ORDRE.length - 1); // 0 au début, 1 à la fin
  const gagne = VICTOIRES[i] === 1;
  const duree = Math.round(autour(780, 140)); // 10 à 15 minutes
  const sbiresMin = arrondi(autour(5.7 + 1.4 * progression + (gagne ? 0.3 : -0.3), 0.35), 2);
  const morts = gagne ? Math.round(autour(1, 1)) : Math.round(autour(2.4, 1));
  const kills = gagne ? Math.round(autour(4, 1.5)) : Math.round(autour(1.6, 1.2));
  const objets = modele.objets.filter(([, p]) => hasard() < p).map(([o]) => o);
  const tirageRune = hasard();
  const rune = modele.runes.find(([, cumul]) => tirageRune < cumul)?.[0] ?? modele.runes[0][0];
  const sbires10 = Math.round(autour(58 + 9 * progression + (gagne ? 2 : -2), 4));
  return {
    matchId: `exemple-${i + 1}`,
    format: "1v1",
    champion: modele.champion,
    championId: modele.championId,
    poste: null,
    gagne,
    joueLe: new Date(Date.UTC(2026, 8, 6 + Math.round(i * 1.2), 19, 30)).toISOString(),
    kills,
    deaths: morts,
    assists: 0,
    valeurs: {
      kda: arrondi(kills / Math.max(1, morts), 2),
      sbires_min: sbiresMin,
      sbires_10: duree >= 600 ? sbires10 : null,
      morts_10min: arrondi(morts / (duree / 600), 2),
      degats_min: arrondi(autour(gagne ? 840 : 720, 70), 1),
      or_min: arrondi(autour(gagne ? 480 : 420, 25), 1),
      premier_sang: gagne ? (hasard() < 0.6 ? 1 : 0) : hasard() < 0.3 ? 1 : 0,
    },
    objets,
    runePrincipale: rune,
    styleSecondaire: null,
    sorts: modele.sorts,
  };
}

export const PARTIES_EXEMPLE: PartieBilan[] = ORDRE.map(partieExemple);

/** Repères d'exemple : moyennes et écarts des vainqueurs et des perdants de 180 parties fictives. */
export const REPERES_EXEMPLE: Repere[] = [
  { indicateur: "kda", parties: 180, moyenneGagnants: 4.1, ecartGagnants: 2.2, moyennePerdants: 1.6, ecartPerdants: 1.1 },
  { indicateur: "sbires_min", parties: 180, moyenneGagnants: 7.4, ecartGagnants: 1, moyennePerdants: 6.5, ecartPerdants: 1 },
  { indicateur: "sbires_10", parties: 164, moyenneGagnants: 71, ecartGagnants: 9, moyennePerdants: 64, ecartPerdants: 9 },
  { indicateur: "morts_10min", parties: 180, moyenneGagnants: 1.5, ecartGagnants: 0.7, moyennePerdants: 2.6, ecartPerdants: 0.8 },
  { indicateur: "degats_min", parties: 180, moyenneGagnants: 760, ecartGagnants: 150, moyennePerdants: 640, ecartPerdants: 140 },
  { indicateur: "or_min", parties: 180, moyenneGagnants: 470, ecartGagnants: 45, moyennePerdants: 410, ecartPerdants: 40 },
  { indicateur: "premier_sang", parties: 180, moyenneGagnants: 0.62, ecartGagnants: 0.49, moyennePerdants: 0.38, ecartPerdants: 0.49 },
];

/** Builds de référence d'exemple (parties fictives d'autres joueurs). */
const REFERENCES_EXEMPLE: Record<string, LigneReperesBuild[]> = {
  Ahri: [
    { genre: "total", valeur: null, parties: 64, victoires: 35 },
    { genre: "objet", valeur: "6655", parties: 55, victoires: 31 },
    { genre: "objet", valeur: "3020", parties: 58, victoires: 30 },
    { genre: "objet", valeur: "3157", parties: 33, victoires: 21 },
    { genre: "objet", valeur: "3089", parties: 26, victoires: 17 },
    { genre: "objet", valeur: "4645", parties: 22, victoires: 12 },
    { genre: "rune", valeur: "8112", parties: 41, victoires: 22 },
    { genre: "rune", valeur: "8229", parties: 17, victoires: 9 },
    { genre: "rune", valeur: "8128", parties: 6, victoires: 4 },
    { genre: "sorts", valeur: "4,14", parties: 57, victoires: 32 },
    { genre: "sorts", valeur: "4,21", parties: 7, victoires: 3 },
  ],
  Zed: [
    { genre: "total", valeur: null, parties: 40, victoires: 22 },
    { genre: "objet", valeur: "3142", parties: 37, victoires: 20 },
    { genre: "objet", valeur: "6692", parties: 26, victoires: 14 },
    { genre: "objet", valeur: "3158", parties: 22, victoires: 12 },
    { genre: "objet", valeur: "3814", parties: 19, victoires: 11 },
    { genre: "objet", valeur: "6694", parties: 16, victoires: 10 },
    { genre: "rune", valeur: "8112", parties: 25, victoires: 14 },
    { genre: "rune", valeur: "8010", parties: 15, victoires: 8 },
    { genre: "sorts", valeur: "4,14", parties: 38, victoires: 21 },
  ],
  // Yasuo : pas encore assez de parties d'autres joueurs pour un build de référence.
  Yasuo: [
    { genre: "total", valeur: null, parties: 8, victoires: 4 },
    { genre: "objet", valeur: "3031", parties: 8, victoires: 4 },
  ],
};

const OBJETS_CONSOMMES = new Set([2003, 2031, 2033, 2055]);

export const BILAN_EXEMPLE: Bilan = construireBilan(PARTIES_EXEMPLE, "1v1", REPERES_EXEMPLE);

export const BUILDS_EXEMPLE: BuildChampion[] = BILAN_EXEMPLE.champions
  .slice(0, 3)
  .map((c) =>
    construireBuild(PARTIES_EXEMPLE, c.champion, REFERENCES_EXEMPLE[c.champion] ?? [], (o) => !OBJETS_CONSOMMES.has(o)),
  );

// ---------- Parties classées (bilan, étape 2) ----------
// 41 parties classées fictives en 12 soirées, au poste milieu, rang Or II :
// le même joueur fictif, pour montrer le niveau, l'hygiène de jeu, la carte
// des morts et le sang-froid. Les résultats de chaque soirée sont écrits
// à la main (après deux défaites, il perd souvent la suivante).

const hasardClassees = generateur(20261006);
const autourC = (centre: number, ecart: number) => centre + (hasardClassees() * 2 - 1) * ecart;

const SOIREES = [
  "VDV", "DDDV", "VVD", "VDDDD", "DVV", "VDDD", "VV", "DDDD", "VDV", "VDDD", "DDDV", "VV",
];

interface ModeleClassee {
  champion: string;
  championId: number;
  objets: [number, number][];
  rune: number;
}
const MODELES_CLASSEES: ModeleClassee[] = [
  { champion: "Ahri", championId: 103, objets: [[6655, 0.9], [3020, 1], [3157, 0.5], [4645, 0.35], [3089, 0.2]], rune: 8112 },
  { champion: "Syndra", championId: 134, objets: [[6655, 0.85], [3020, 1], [3089, 0.5], [3135, 0.4], [3157, 0.3]], rune: 8229 },
  { champion: "Orianna", championId: 61, objets: [[6655, 0.8], [3020, 1], [3157, 0.45], [3102, 0.3]], rune: 8229 },
];

/** Lieu d'une mort, vu du côté du joueur : jungle adverse, voie du milieu, rivière ou ailleurs. */
function lieuMort(): { x: number; y: number; minute: number } {
  const tirage = hasardClassees();
  if (tirage < 0.45) return { x: autourC(11400, 700), y: autourC(6200, 700), minute: autourC(15, 5) };
  if (tirage < 0.65) {
    const d = autourC(7400, 900);
    return { x: d + autourC(0, 500), y: d, minute: autourC(6, 4) };
  }
  if (tirage < 0.85) {
    const x = autourC(5500, 1400);
    return { x, y: TAILLE_CARTE - x + autourC(0, 700), minute: autourC(20, 6) };
  }
  return { x: autourC(12000, 1500), y: autourC(10500, 1500), minute: autourC(28, 6) };
}

function lignesClassees(): LigneIndicateursClassees[] {
  const lignes: LigneIndicateursClassees[] = [];
  SOIREES.forEach((soiree, s) => {
    [...soiree].forEach((resultat, rang) => {
      const i = lignes.length;
      const gagne = resultat === "V";
      const modele = MODELES_CLASSEES[i % 3 === 2 ? (i % 2) + 1 : 0];
      const duree = Math.round(autourC(1800, 300));
      const equipe = i % 2 === 0 ? 100 : 200;
      const morts = gagne ? Math.round(autourC(2.5, 1.5)) : Math.round(autourC(5, 1.5));
      const kills = gagne ? Math.round(autourC(7, 3)) : Math.round(autourC(3, 2));
      const assists = Math.round(autourC(gagne ? 9 : 5, 3));
      const lieux = Array.from({ length: morts }, lieuMort).map((l) => {
        const vrai = equipe === 200 ? { x: TAILLE_CARTE - l.x, y: TAILLE_CARTE - l.y } : { x: l.x, y: l.y };
        return { ...vrai, seconde: Math.min(duree - 30, Math.max(60, Math.round(l.minute * 60))) };
      });
      // Soirées du 7 septembre au 4 octobre 2026, à partir de 20 h 30 (heure de Paris), 35 minutes par partie.
      const debut = Date.UTC(2026, 8, 7 + Math.round(s * 2.4), 18, 30) + rang * 35 * 60_000;
      lignes.push({
        id: i + 1,
        riot_match_id: `EUW1_EXEMPLE${i + 1}`,
        file: 420,
        palier: "GOLD",
        champion: modele.champion,
        champion_id: modele.championId,
        poste: "MIDDLE",
        gagne,
        joue_le: new Date(debut).toISOString(),
        duree_secondes: duree,
        equipe,
        kills,
        deaths: morts,
        assists,
        kda: Math.round(((kills + assists) / Math.max(1, morts)) * 100) / 100,
        sbires_min: Math.round(autourC(gagne ? 7.1 : 6.6, 0.4) * 100) / 100,
        sbires_10: Math.round(autourC(gagne ? 70 : 64, 5)),
        morts_10min: Math.round((morts / (duree / 600)) * 100) / 100,
        degats_min: Math.round(autourC(gagne ? 740 : 650, 60) * 10) / 10,
        or_min: Math.round(autourC(gagne ? 430 : 375, 20) * 10) / 10,
        vision_min: Math.round(autourC(0.7, 0.12) * 100) / 100,
        part_kills: Math.round(autourC(0.64, 0.08) * 1000) / 1000,
        part_degats: Math.round(autourC(0.27, 0.04) * 1000) / 1000,
        premier_sang: hasardClassees() < 0.15 ? 1 : 0,
        ecart_or_15: Math.round(autourC(gagne ? 350 : -250, 450)),
        morts_avant_10: gagne ? (hasardClassees() < 0.3 ? 1 : 0) : hasardClassees() < 0.6 ? 1 : 0,
        objets: modele.objets.filter(([, p]) => hasardClassees() < p).map(([o]) => o),
        rune_principale: modele.rune,
        style_secondaire: null,
        sorts: [4, 12],
        morts_secondes: lieux.map((l) => l.seconde),
        morts_x: lieux.map((l) => Math.round(l.x)),
        morts_y: lieux.map((l) => Math.round(l.y)),
      });
    });
  });
  return lignes;
}

export const LIGNES_CLASSEES_EXEMPLE: LigneIndicateursClassees[] = lignesClassees();
export const PARTIES_CLASSEES_EXEMPLE: PartieBilan[] = LIGNES_CLASSEES_EXEMPLE.map(partieClasseeDepuisLigne);

/** Repères d'exemple : vainqueurs et perdants de 640 parties classées fictives, Or au milieu. */
export const REPERES_CLASSEES_EXEMPLE: Repere[] = [
  { indicateur: "kda", parties: 640, moyenneGagnants: 4, ecartGagnants: 2, moyennePerdants: 1.8, ecartPerdants: 1 },
  { indicateur: "sbires_min", parties: 640, moyenneGagnants: 7.6, ecartGagnants: 1, moyennePerdants: 6.9, ecartPerdants: 1 },
  { indicateur: "sbires_10", parties: 610, moyenneGagnants: 70, ecartGagnants: 9, moyennePerdants: 64, ecartPerdants: 9 },
  { indicateur: "morts_10min", parties: 640, moyenneGagnants: 1.4, ecartGagnants: 0.6, moyennePerdants: 2.3, ecartPerdants: 0.7 },
  { indicateur: "morts_avant_10", parties: 620, moyenneGagnants: 0.3, ecartGagnants: 0.5, moyennePerdants: 0.7, ecartPerdants: 0.7 },
  { indicateur: "ecart_or_15", parties: 600, moyenneGagnants: 420, ecartGagnants: 900, moyennePerdants: -380, ecartPerdants: 900 },
  { indicateur: "degats_min", parties: 640, moyenneGagnants: 760, ecartGagnants: 180, moyennePerdants: 640, ecartPerdants: 170 },
  { indicateur: "or_min", parties: 640, moyenneGagnants: 430, ecartGagnants: 50, moyennePerdants: 370, ecartPerdants: 45 },
  { indicateur: "vision_min", parties: 640, moyenneGagnants: 0.85, ecartGagnants: 0.25, moyennePerdants: 0.75, ecartPerdants: 0.25 },
  { indicateur: "part_kills", parties: 640, moyenneGagnants: 0.58, ecartGagnants: 0.12, moyennePerdants: 0.5, ecartPerdants: 0.13 },
  { indicateur: "part_degats", parties: 640, moyenneGagnants: 0.28, ecartGagnants: 0.06, moyennePerdants: 0.26, ecartPerdants: 0.06 },
  { indicateur: "premier_sang", parties: 640, moyenneGagnants: 0.2, ecartGagnants: 0.4, moyennePerdants: 0.1, ecartPerdants: 0.3 },
];

/** Place d'exemple parmi 30 joueurs fictifs Or au milieu (percentiles_classees). */
const POSITIONS_CLASSEES_EXEMPLE = [
  { indicateur: "sbires_min", joueurs: 30, en_dessous: 11, egaux: 0 },
  { indicateur: "sbires_10", joueurs: 30, en_dessous: 17, egaux: 1 },
  { indicateur: "morts_10min", joueurs: 30, en_dessous: 19, egaux: 0 },
  { indicateur: "morts_avant_10", joueurs: 30, en_dessous: 15, egaux: 2 },
  { indicateur: "ecart_or_15", joueurs: 30, en_dessous: 12, egaux: 0 },
  { indicateur: "degats_min", joueurs: 30, en_dessous: 14, egaux: 0 },
  { indicateur: "vision_min", joueurs: 30, en_dessous: 9, egaux: 1 },
  { indicateur: "part_kills", joueurs: 30, en_dessous: 24, egaux: 0 },
];

/** Six parties fictives de tournoi 5v5 au milieu, un peu en dessous des classées : le sang-froid. */
const TOURNOI_5V5_EXEMPLE: PartieBilan[] = Array.from({ length: 6 }, (_, i) => ({
  matchId: `exemple-5v5-${i + 1}`,
  format: "5v5",
  champion: "Ahri",
  championId: 103,
  poste: "MIDDLE",
  gagne: i % 2 === 0,
  joueLe: new Date(Date.UTC(2026, 8, 13 + i * 4, 18)).toISOString(),
  kills: 4,
  deaths: 4,
  assists: 6,
  valeurs: {
    sbires_min: Math.round(autourC(6.4, 0.3) * 100) / 100,
    morts_10min: Math.round(autourC(1.7, 0.3) * 100) / 100,
    degats_min: Math.round(autourC(640, 40)),
    part_kills: Math.round(autourC(0.58, 0.05) * 1000) / 1000,
    vision_min: Math.round(autourC(0.62, 0.08) * 100) / 100,
  },
  objets: [],
  runePrincipale: null,
  styleSecondaire: null,
  sorts: [],
}));

const REFERENCES_CLASSEES_EXEMPLE: Record<string, LigneReperesBuild[]> = {
  Ahri: [
    { genre: "total", valeur: null, parties: 180, victoires: 92 },
    { genre: "objet", valeur: "6655", parties: 160, victoires: 84 },
    { genre: "objet", valeur: "3020", parties: 170, victoires: 86 },
    { genre: "objet", valeur: "3157", parties: 95, victoires: 55 },
    { genre: "objet", valeur: "3135", parties: 70, victoires: 44 },
    { genre: "objet", valeur: "4645", parties: 60, victoires: 31 },
    { genre: "rune", valeur: "8112", parties: 120, victoires: 63 },
    { genre: "rune", valeur: "8229", parties: 50, victoires: 24 },
    { genre: "sorts", valeur: "4,12", parties: 110, victoires: 58 },
    { genre: "sorts", valeur: "4,14", parties: 70, victoires: 34 },
  ],
  Syndra: [
    { genre: "total", valeur: null, parties: 96, victoires: 47 },
    { genre: "objet", valeur: "6655", parties: 88, victoires: 44 },
    { genre: "objet", valeur: "3020", parties: 90, victoires: 45 },
    { genre: "objet", valeur: "3089", parties: 60, victoires: 33 },
    { genre: "objet", valeur: "3135", parties: 52, victoires: 30 },
    { genre: "rune", valeur: "8229", parties: 70, victoires: 35 },
    { genre: "sorts", valeur: "4,12", parties: 80, victoires: 40 },
  ],
};

const OBJETS_CONSOMMES_CLASSEES = new Set([2003, 2031, 2033, 2055]);

export const BILAN_CLASSEES_EXEMPLE: Bilan = construireBilan(PARTIES_CLASSEES_EXEMPLE, "classees", REPERES_CLASSEES_EXEMPLE);

export const BUILDS_CLASSEES_EXEMPLE: BuildChampion[] = BILAN_CLASSEES_EXEMPLE.champions
  .slice(0, 3)
  .map((c) =>
    construireBuild(PARTIES_CLASSEES_EXEMPLE, c.champion, REFERENCES_CLASSEES_EXEMPLE[c.champion] ?? [], (o) =>
      !OBJETS_CONSOMMES_CLASSEES.has(o),
    ),
  );

export const EXTRAS_CLASSEES_EXEMPLE: {
  rang: string | null;
  groupe: string | null;
  niveau: PositionNiveau[];
  sangFroid: SangFroid | null;
  hygiene: Hygiene | null;
  carte: CarteMorts | null;
} = {
  rang: libelleRang("GOLD", "II", 45),
  groupe: `joueurs Or au poste ${LIBELLE_POSTE.MIDDLE}`,
  niveau: positionsNiveau(POSITIONS_CLASSEES_EXEMPLE),
  sangFroid: sangFroid(TOURNOI_5V5_EXEMPLE, PARTIES_CLASSEES_EXEMPLE),
  hygiene: hygieneDeJeu(
    LIGNES_CLASSEES_EXEMPLE.map((l) => ({ joueLe: l.joue_le, dureeSecondes: l.duree_secondes, gagne: l.gagne })),
  ),
  carte: carteDesMorts(LIGNES_CLASSEES_EXEMPLE),
};
