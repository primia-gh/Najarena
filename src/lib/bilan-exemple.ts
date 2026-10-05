// Bilan d'exemple de /lol/bilan : un joueur fictif (TON_PSEUDO), des
// parties et des repères fictifs, jamais écrits en base — comme le tournoi
// d'exemple (/lol/tournois/demo). Calculé par les mêmes fonctions que le
// vrai bilan (src/lib/bilan.ts) : ce que montre l'exemple est exactement
// ce que voit un joueur. Tirage pseudo-aléatoire à graine fixe : la page
// est identique à chaque affichage.

import {
  construireBilan,
  construireBuild,
  type Bilan,
  type BuildChampion,
  type LigneReperesBuild,
  type PartieBilan,
  type Repere,
} from "./bilan";

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
