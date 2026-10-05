// Bilan du joueur, étape 1 (05/10/2026) : forces, axes de travail,
// progression, champions, builds et plan d'entraînement, calculés sur les
// seules parties vérifiées de Najarena (verdict lu chez Riot). Chaque
// constat porte ses chiffres et le nombre de parties sur lequel il repose ;
// rien n'est deviné, rien n'est rédigé par une IA. Les formules des
// indicateurs et des repères sont en base (vue indicateurs_partie,
// reperes_bilan, reperes_build — docs/schema.sql). Logique pure, testée
// dans bilan.test.ts.
// Étape 2 (05/10/2026) : les parties classées lues chez Riot avec l'accord
// du joueur forment un troisième « format », comparé aux joueurs du même
// rang Riot et du même poste (vue indicateurs_classees, reperes_classees).

export type FormatBilan = "1v1" | "5v5" | "classees";

export type CleIndicateur =
  | "kda"
  | "sbires_min"
  | "sbires_10"
  | "morts_10min"
  | "degats_min"
  | "or_min"
  | "vision_min"
  | "part_kills"
  | "part_degats"
  | "premier_sang"
  | "ecart_or_15"
  | "morts_avant_10";

export interface DefinitionIndicateur {
  libelle: string;
  /** 1 : plus c'est haut, mieux c'est ; -1 : l'inverse (les morts). */
  sens: 1 | -1;
  decimales: number;
  /** Taux ou part entre 0 et 1, affiché en pourcentage. */
  pourcentage?: boolean;
  /** Oui ou non à chaque partie (premier sang) : la moyenne est une part des parties. */
  parPartie?: boolean;
  /** Écart signé (« +450 », « −300 »). */
  signe?: boolean;
  /** Conseil donné quand l'indicateur est un axe de travail. */
  conseil?: Partial<Record<FormatBilan, string>>;
}

export const INDICATEURS: Record<CleIndicateur, DefinitionIndicateur> = {
  kda: { libelle: "KDA", sens: 1, decimales: 2 },
  sbires_min: {
    libelle: "Sbires par minute",
    sens: 1,
    decimales: 1,
    conseil: {
      "1v1":
        "Le farm, c'est de l'or garanti. Entraîne le dernier coup en partie d'entraînement, et sous ta tour, alterne tirs de la tour et dernier coup pour ne perdre aucun sbire.",
      "5v5":
        "Entre deux combats, retourne prendre les vagues de sbires de ton côté de la carte : une vague laissée à l'abandon, c'est de l'or perdu sans contrepartie.",
    },
  },
  sbires_10: {
    libelle: "Sbires à 10 minutes",
    sens: 1,
    decimales: 0,
    conseil: {
      "1v1":
        "Tes 10 premières minutes décident de ton premier objet : fixe-toi un nombre de sbires à 10 minutes et vérifie-le à chaque partie.",
      "5v5":
        "Tes 10 premières minutes décident de ton premier objet : fixe-toi un nombre de sbires à 10 minutes et vérifie-le à chaque partie.",
    },
  },
  morts_10min: {
    libelle: "Morts par 10 minutes",
    sens: -1,
    decimales: 1,
    conseil: {
      "1v1":
        "Chaque mort donne à ton adversaire de l'or et le temps de pousser. Garde une marge de vie et respecte ses moments forts : son ultime au niveau 6, son premier objet terminé.",
      "5v5":
        "Chaque mort laisse ton équipe à quatre. Quand ta vague est poussée et que tu ne vois pas les adversaires sur la carte, recule plutôt que de rester exposé.",
    },
  },
  degats_min: {
    libelle: "Dégâts aux champions par minute",
    sens: 1,
    decimales: 0,
    conseil: {
      "1v1":
        "Touche ton adversaire quand il s'avance pour prendre un sbire : c'est le moment où il ne peut pas répondre librement.",
      "5v5":
        "En combat, place-toi pour toucher les adversaires dès le début, pas seulement à la fin : des dégâts qui arrivent trop tard ne changent pas l'issue.",
    },
  },
  or_min: { libelle: "Or par minute", sens: 1, decimales: 0 },
  vision_min: {
    libelle: "Score de vision par minute",
    sens: 1,
    decimales: 2,
    conseil: {
      "5v5":
        "Pose ta balise gratuite dès qu'elle est rechargée et achète une balise de contrôle à chaque retour : la vision évite des morts et prépare les objectifs.",
    },
  },
  part_kills: {
    libelle: "Participation aux éliminations",
    sens: 1,
    decimales: 0,
    pourcentage: true,
    conseil: {
      "5v5":
        "Regarde la carte toutes les quelques secondes et rejoins les combats qui se préparent autour des objectifs (dragons, Nashor) plutôt que de rester seul sur ta voie.",
    },
  },
  part_degats: {
    libelle: "Part des dégâts de l'équipe",
    sens: 1,
    decimales: 0,
    pourcentage: true,
    conseil: {
      "5v5":
        "Cherche les échanges où tu peux toucher sans être la première cible : tes dégâts comptent seulement si tu restes en vie pour les faire.",
    },
  },
  premier_sang: {
    libelle: "Premier sang",
    sens: 1,
    decimales: 0,
    pourcentage: true,
    parPartie: true,
    conseil: {
      "1v1":
        "Le premier sang donne de l'or et un niveau d'avance qui font boule de neige. Prends la vague en entier pour passer le niveau suivant avant ton adversaire, et engage à ce moment-là.",
      "5v5":
        "Le premier sang rapporte de l'or en plus : coordonne-toi avec ton jungler sur les premières minutes plutôt que de jouer seul.",
    },
  },
  // Lus dans la chronologie des parties classées (étape 2).
  ecart_or_15: {
    libelle: "Écart d'or à 15 minutes",
    sens: 1,
    decimales: 0,
    signe: true,
    conseil: {
      "5v5":
        "À 15 minutes, l'or vient surtout de ta voie : ne laisse passer aucune vague, rentre à la base quand ta vague est poussée et que tu as de quoi acheter un objet, et évite les échanges que ton champion perd en début de partie.",
    },
  },
  morts_avant_10: {
    libelle: "Morts avant 10 minutes",
    sens: -1,
    decimales: 1,
    conseil: {
      "5v5":
        "Une mort avant 10 minutes coûte la vague, l'expérience et souvent ton premier objet. Pose une balise vers la rivière et recule dès que le jungler adverse disparaît de la carte.",
    },
  },
};

/** Indicateurs suivis dans chaque format (la vision et les parts n'ont pas de sens en 1v1). */
export const INDICATEURS_PAR_FORMAT: Record<FormatBilan, CleIndicateur[]> = {
  "1v1": ["kda", "sbires_min", "sbires_10", "morts_10min", "degats_min", "or_min", "premier_sang"],
  "5v5": [
    "kda",
    "sbires_min",
    "sbires_10",
    "morts_10min",
    "degats_min",
    "or_min",
    "vision_min",
    "part_kills",
    "part_degats",
    "premier_sang",
  ],
  classees: [
    "kda",
    "sbires_min",
    "sbires_10",
    "morts_10min",
    "morts_avant_10",
    "ecart_or_15",
    "degats_min",
    "or_min",
    "vision_min",
    "part_kills",
    "part_degats",
    "premier_sang",
  ],
};

/** Conseil d'un indicateur dans un format (les classées reprennent ceux du 5v5). */
export function conseilDe(cle: CleIndicateur, format: FormatBilan): string | undefined {
  const conseil = INDICATEURS[cle].conseil;
  return conseil?.[format] ?? (format === "classees" ? conseil?.["5v5"] : undefined);
}

/**
 * Indicateurs qui deviennent des forces ou des axes de travail : ceux qu'on
 * travaille directement, et qui ont un conseil. Le KDA et l'or suivent
 * surtout l'issue de la partie (le vainqueur en a toujours plus) : ils
 * sont montrés, jamais donnés comme conseil.
 */
function indicateursConseil(format: FormatBilan): CleIndicateur[] {
  return INDICATEURS_PAR_FORMAT[format].filter((cle) => conseilDe(cle, format));
}

export const LIBELLE_POSTE: Record<string, string> = {
  TOP: "Haut",
  JUNGLE: "Jungle",
  MIDDLE: "Milieu",
  BOTTOM: "Tireur",
  UTILITY: "Support",
};

// Seuils, repris tels quels dans les textes de la page.
export const PARTIES_MIN_BILAN = 5;
/** Parties vérifiées d'autres joueurs qu'il faut pour comparer un indicateur aux vainqueurs. */
export const PARTIES_MIN_REPERE = 30;
/** Victoires et défaites qu'il faut, chacune, pour comparer le joueur à lui-même. */
export const PARTIES_MIN_COMPARAISON = 3;
export const PARTIES_FIABLE = 15;
export const PARTIES_MIN_BUILD_REFERENCE = 10;
export const FENETRE_MOYENNE = 5;
export const PARTIES_RECENTES = 5;
export const PARTIES_COURBE = 30;
const ECART_SIGNIFICATIF = 0.2; // en écarts types
const DISCRIMINATION_MIN = 0.1;
const IMPORTANCE_MIN = 0.3;

export interface PartieBilan {
  matchId: string;
  format: FormatBilan;
  champion: string;
  championId: number | null;
  poste: string | null;
  gagne: boolean;
  joueLe: string;
  kills: number;
  deaths: number;
  assists: number;
  valeurs: Partial<Record<CleIndicateur, number | null>>;
  objets: number[];
  runePrincipale: number | null;
  styleSecondaire: number | null;
  sorts: number[];
}

export interface Repere {
  indicateur: CleIndicateur;
  parties: number;
  moyenneGagnants: number | null;
  ecartGagnants: number | null;
  moyennePerdants: number | null;
  ecartPerdants: number | null;
}

export interface Constat {
  indicateur: CleIndicateur;
  /** Valeur du joueur : sa moyenne, ou sa moyenne récente pour un progrès. */
  valeur: number;
  /** Valeur de comparaison : vainqueurs, tes victoires, ou toi avant. */
  repere: number;
  source: "vainqueurs" | "tes_victoires" | "toi_avant";
  /** Tes défaites (comparaison avec tes propres parties). */
  valeurDefaites?: number;
  partiesJoueur: number;
  partiesRepere: number;
  fiabilite: "fiable" | "indicatif";
}

export interface PointCourbe {
  joueLe: string;
  valeur: number;
  gagne: boolean;
  /** Moyenne des 5 dernières parties, à partir de la 5e. */
  moyenne: number | null;
}

export interface SerieProgression {
  indicateur: CleIndicateur;
  points: PointCourbe[];
  /** Moyenne des 5 dernières parties et des 5 précédentes ; nulles sous 10 parties. */
  recente: number | null;
  precedente: number | null;
  tendance: "progres" | "recul" | "stable" | null;
  /** Moyenne des vainqueurs, tracée en pointillé quand elle existe. */
  repere: number | null;
}

export interface LigneChampion {
  champion: string;
  championId: number | null;
  parties: number;
  victoires: number;
  kda: number;
  sbiresMin: number | null;
  /** Première moitié de ses parties contre la seconde (6 parties au moins). */
  apprentissage: "progres" | "recul" | "stable" | null;
}

export interface Objectif {
  indicateur: CleIndicateur;
  cible: number;
  actuel: number;
  recent: number | null;
  statut: "atteint" | "en_bonne_voie" | "a_travailler";
  source: Constat["source"];
}

export interface Bilan {
  format: FormatBilan;
  parties: number;
  victoires: number;
  premiere: string | null;
  derniere: string | null;
  championPrincipal: { champion: string; championId: number | null; parties: number } | null;
  /** 5v5 : poste le plus joué (5 parties au moins) ; les comparaisons portent sur ses parties à ce poste. */
  postePrincipal: string | null;
  /** Parties sur lesquelles portent forces, axes, progression et plan. */
  partiesComparees: number;
  /** Parties qui manquent pour un bilan (0 quand il est prêt). */
  partiesManquantes: number;
  /** Repère disponible : les vainqueurs des autres joueurs, ou seulement tes propres parties. */
  comparaison: "vainqueurs" | "tes_parties" | null;
  partiesRepere: number;
  forces: Constat[];
  axes: Constat[];
  /** Indicateurs dans la moyenne des vainqueurs (ni force, ni axe). */
  auNiveau: CleIndicateur[];
  progression: SerieProgression[];
  champions: LigneChampion[];
  championLePlusSolide: LigneChampion | null;
  plan: Objectif[];
}

// ---------- Outils ----------

function moyenne(valeurs: number[]): number {
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

function ecartType(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const m = moyenne(valeurs);
  return Math.sqrt(valeurs.reduce((s, v) => s + (v - m) ** 2, 0) / (valeurs.length - 1));
}

function valeursDe(parties: PartieBilan[], cle: CleIndicateur): number[] {
  return parties.flatMap((p) => {
    const v = p.valeurs[cle];
    return typeof v === "number" && Number.isFinite(v) ? [v] : [];
  });
}

function fiabilite(parties: number): Constat["fiabilite"] {
  return parties >= PARTIES_FIABLE ? "fiable" : "indicatif";
}

/** Borne basse de Wilson (z = 1) : un taux de victoire qui tient compte du nombre de parties. */
export function tauxPrudent(victoires: number, parties: number): number {
  if (parties === 0) return 0;
  const z = 1;
  const p = victoires / parties;
  const denominateur = 1 + (z * z) / parties;
  const centre = p + (z * z) / (2 * parties);
  const marge = z * Math.sqrt((p * (1 - p)) / parties + (z * z) / (4 * parties * parties));
  return (centre - marge) / denominateur;
}

const NOMBRE = new Map<string, Intl.NumberFormat>();

/** « 7,8 », « 62 % », « 1 204 », « +450 » : la valeur d'un indicateur telle qu'affichée. */
export function formaterIndicateur(cle: CleIndicateur, valeur: number): string {
  const def = INDICATEURS[cle];
  if (def.pourcentage) return `${Math.round(valeur * 100)} %`;
  const cleFormat = `${def.decimales}${def.signe ? "s" : ""}`;
  let format = NOMBRE.get(cleFormat);
  if (!format) {
    format = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: def.decimales,
      maximumFractionDigits: def.decimales,
      signDisplay: def.signe ? "exceptZero" : "auto",
    });
    NOMBRE.set(cleFormat, format);
  }
  return format.format(valeur);
}

const FORMATS: FormatBilan[] = ["1v1", "5v5", "classees"];

export function estFormatBilan(valeur: string | null | undefined): valeur is FormatBilan {
  return (FORMATS as string[]).includes(valeur ?? "");
}

/** Format montré par défaut : celui demandé s'il a des parties, sinon le plus joué. */
export function choisirFormat(parties: PartieBilan[], demande?: string | null): FormatBilan {
  const compte = (f: FormatBilan) => parties.filter((p) => p.format === f).length;
  if (estFormatBilan(demande) && compte(demande) > 0) return demande;
  return FORMATS.reduce((meilleur, f) => (compte(f) > compte(meilleur) ? f : meilleur), FORMATS[0]);
}

/** Poste le plus joué, s'il est connu (5v5). */
export function postePrincipal(parties: PartieBilan[]): string | null {
  const compte = new Map<string, number>();
  for (const p of parties) if (p.poste) compte.set(p.poste, (compte.get(p.poste) ?? 0) + 1);
  return [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/**
 * Poste auquel comparer un joueur de 5v5 : son poste le plus joué, s'il y a
 * au moins 5 parties. Sinon aucun (pas de comparaison avec les autres
 * joueurs : un sbire par minute ne veut pas dire la même chose au milieu et
 * en support).
 */
export function posteCompare(parties: PartieBilan[]): string | null {
  const poste = postePrincipal(parties);
  return poste && parties.filter((p) => p.poste === poste).length >= PARTIES_MIN_BILAN ? poste : null;
}

/** Les chiffres d'un constat, en une phrase (le nom de l'indicateur est affiché à côté). */
export function detailConstat(c: Constat): string {
  const v = formaterIndicateur(c.indicateur, c.valeur);
  const r = formaterIndicateur(c.indicateur, c.repere);
  const d = formaterIndicateur(c.indicateur, c.valeurDefaites ?? c.valeur);
  const parPartie = INDICATEURS[c.indicateur].parPartie;
  switch (c.source) {
    case "vainqueurs":
      return parPartie
        ? `Dans ${v} de tes parties, contre ${r} pour les vainqueurs.`
        : `${v} en moyenne, contre ${r} pour les vainqueurs.`;
    case "tes_victoires":
      return parPartie
        ? `Dans ${r} de tes victoires, ${d} de tes défaites.`
        : `${r} dans tes victoires, ${d} dans tes défaites.`;
    case "toi_avant":
      return parPartie
        ? `Dans ${v} de tes ${PARTIES_RECENTES} dernières parties, contre ${r} avant.`
        : `${v} sur tes ${PARTIES_RECENTES} dernières parties, contre ${r} avant.`;
  }
}

// ---------- Forces et axes de travail ----------

interface Candidat {
  constat: Constat;
  score: number;
}

/** Comparaison avec les vainqueurs des parties vérifiées des autres joueurs. */
function comparerAuxVainqueurs(parties: PartieBilan[], format: FormatBilan, reperes: Repere[]) {
  const forces: Candidat[] = [];
  const axes: Candidat[] = [];
  const auNiveau: CleIndicateur[] = [];
  let partiesRepere = 0;
  for (const cle of indicateursConseil(format)) {
    const r = reperes.find((x) => x.indicateur === cle);
    const valeurs = valeursDe(parties, cle);
    if (!r || r.parties < PARTIES_MIN_REPERE || valeurs.length < PARTIES_MIN_BILAN) continue;
    if (r.moyenneGagnants === null || r.moyennePerdants === null) continue;
    const dispersion = Math.sqrt(((r.ecartGagnants ?? 0) ** 2 + (r.ecartPerdants ?? 0) ** 2) / 2);
    if (dispersion <= 0) continue;
    const sens = INDICATEURS[cle].sens;
    // Un indicateur qui ne sépare pas vainqueurs et perdants n'est ni une force ni un axe.
    const discrimination = (sens * (r.moyenneGagnants - r.moyennePerdants)) / dispersion;
    if (discrimination < DISCRIMINATION_MIN) continue;
    partiesRepere = Math.max(partiesRepere, r.parties);
    const valeur = moyenne(valeurs);
    const ecart = (sens * (valeur - r.moyenneGagnants)) / dispersion;
    const constat: Constat = {
      indicateur: cle,
      valeur,
      repere: r.moyenneGagnants,
      source: "vainqueurs",
      partiesJoueur: valeurs.length,
      partiesRepere: r.parties,
      fiabilite: fiabilite(valeurs.length),
    };
    // Score = écart × poids de l'indicateur dans la victoire.
    if (ecart >= ECART_SIGNIFICATIF) forces.push({ constat, score: ecart * discrimination });
    else if (ecart <= -ECART_SIGNIFICATIF) axes.push({ constat, score: -ecart * discrimination });
    else auNiveau.push(cle);
  }
  return { forces, axes, auNiveau, partiesRepere };
}

/** Sans repère (ou en complément) : ce qui sépare tes victoires de tes défaites. */
function comparerATesParties(parties: PartieBilan[], format: FormatBilan): Candidat[] {
  const axes: Candidat[] = [];
  const victoires = parties.filter((p) => p.gagne);
  const defaites = parties.filter((p) => !p.gagne);
  for (const cle of indicateursConseil(format)) {
    const enVictoire = valeursDe(victoires, cle);
    const enDefaite = valeursDe(defaites, cle);
    if (enVictoire.length < PARTIES_MIN_COMPARAISON || enDefaite.length < PARTIES_MIN_COMPARAISON) continue;
    const dispersion = ecartType([...enVictoire, ...enDefaite]);
    if (dispersion <= 0) continue;
    const mv = moyenne(enVictoire);
    const md = moyenne(enDefaite);
    const importance = (INDICATEURS[cle].sens * (mv - md)) / dispersion;
    if (importance < IMPORTANCE_MIN) continue;
    axes.push({
      constat: {
        indicateur: cle,
        valeur: moyenne([...enVictoire, ...enDefaite]),
        repere: mv,
        valeurDefaites: md,
        source: "tes_victoires",
        partiesJoueur: enVictoire.length + enDefaite.length,
        partiesRepere: enVictoire.length,
        fiabilite: fiabilite(enVictoire.length + enDefaite.length),
      },
      score: importance,
    });
  }
  return axes;
}

/** Tes progrès : tes 5 dernières parties contre les précédentes. */
function progres(parties: PartieBilan[], format: FormatBilan): Candidat[] {
  const resultat: Candidat[] = [];
  for (const cle of indicateursConseil(format)) {
    const valeurs = valeursDe(parties, cle);
    if (valeurs.length < PARTIES_RECENTES * 2) continue;
    const recentes = valeurs.slice(-PARTIES_RECENTES);
    const avant = valeurs.slice(0, -PARTIES_RECENTES);
    const dispersion = ecartType(valeurs);
    if (dispersion <= 0) continue;
    const gain = (INDICATEURS[cle].sens * (moyenne(recentes) - moyenne(avant))) / dispersion;
    if (gain < IMPORTANCE_MIN) continue;
    resultat.push({
      constat: {
        indicateur: cle,
        valeur: moyenne(recentes),
        repere: moyenne(avant),
        source: "toi_avant",
        partiesJoueur: valeurs.length,
        partiesRepere: avant.length,
        fiabilite: fiabilite(valeurs.length),
      },
      score: gain,
    });
  }
  return resultat;
}

function meilleurs(candidats: Candidat[], nombre: number, sauf: Set<CleIndicateur> = new Set()): Constat[] {
  return candidats
    .filter((c) => !sauf.has(c.constat.indicateur))
    .sort((a, b) => b.score - a.score)
    .slice(0, nombre)
    .map((c) => c.constat);
}

// ---------- Progression ----------

function serieProgression(parties: PartieBilan[], cle: CleIndicateur, reperes: Repere[]): SerieProgression | null {
  const avecValeur = parties.flatMap((p) => {
    const v = p.valeurs[cle];
    return typeof v === "number" && Number.isFinite(v) ? [{ p, v }] : [];
  });
  if (avecValeur.length < FENETRE_MOYENNE) return null;
  const toutes = avecValeur.map((x) => x.v);
  const points: PointCourbe[] = avecValeur.map(({ p, v }, i) => ({
    joueLe: p.joueLe,
    valeur: v,
    gagne: p.gagne,
    moyenne: i >= FENETRE_MOYENNE - 1 ? moyenne(toutes.slice(i - FENETRE_MOYENNE + 1, i + 1)) : null,
  }));
  let recente: number | null = null;
  let precedente: number | null = null;
  let tendance: SerieProgression["tendance"] = null;
  if (toutes.length >= PARTIES_RECENTES * 2) {
    recente = moyenne(toutes.slice(-PARTIES_RECENTES));
    precedente = moyenne(toutes.slice(-PARTIES_RECENTES * 2, -PARTIES_RECENTES));
    const dispersion = ecartType(toutes);
    const ecart = dispersion > 0 ? (INDICATEURS[cle].sens * (recente - precedente)) / dispersion : 0;
    tendance = ecart >= 0.25 ? "progres" : ecart <= -0.25 ? "recul" : "stable";
  }
  const r = reperes.find((x) => x.indicateur === cle);
  return {
    indicateur: cle,
    points: points.slice(-PARTIES_COURBE),
    recente,
    precedente,
    tendance,
    repere: r && r.parties >= PARTIES_MIN_REPERE ? r.moyenneGagnants : null,
  };
}

// ---------- Champions ----------

function kdaDe(parties: PartieBilan[]): number {
  return (
    parties.reduce((s, p) => s + p.kills + p.assists, 0) / Math.max(1, parties.reduce((s, p) => s + p.deaths, 0))
  );
}

function lignesChampions(parties: PartieBilan[]): LigneChampion[] {
  const parChampion = new Map<string, PartieBilan[]>();
  for (const p of parties) parChampion.set(p.champion, [...(parChampion.get(p.champion) ?? []), p]);
  return [...parChampion.entries()]
    .map(([champion, liste]) => {
      const sbires = valeursDe(liste, "sbires_min");
      let apprentissage: LigneChampion["apprentissage"] = null;
      if (liste.length >= 6) {
        const milieu = Math.floor(liste.length / 2);
        const debut = liste.slice(0, milieu);
        const fin = liste.slice(milieu);
        const taux = (l: PartieBilan[]) => l.filter((p) => p.gagne).length / l.length;
        const ecartTaux = taux(fin) - taux(debut);
        const ecartKda = kdaDe(fin) / Math.max(0.01, kdaDe(debut)) - 1;
        apprentissage =
          ecartTaux >= 0.15 || ecartKda >= 0.15
            ? "progres"
            : ecartTaux <= -0.15 || ecartKda <= -0.15
              ? "recul"
              : "stable";
      }
      return {
        champion,
        championId: liste.find((p) => p.championId !== null)?.championId ?? null,
        parties: liste.length,
        victoires: liste.filter((p) => p.gagne).length,
        kda: kdaDe(liste),
        sbiresMin: sbires.length > 0 ? moyenne(sbires) : null,
        apprentissage,
      };
    })
    .sort((a, b) => b.parties - a.parties || b.victoires - a.victoires || a.champion.localeCompare(b.champion));
}

// ---------- Plan d'entraînement ----------

function plan(parties: PartieBilan[], axes: Constat[]): Objectif[] {
  return axes.map((axe) => {
    const valeurs = valeursDe(parties, axe.indicateur);
    const recent = valeurs.length >= PARTIES_RECENTES ? moyenne(valeurs.slice(-PARTIES_RECENTES)) : null;
    const sens = INDICATEURS[axe.indicateur].sens;
    const atteint = recent !== null && sens * (recent - axe.repere) >= 0;
    const enProgres = recent !== null && sens * (recent - axe.valeur) > 0;
    return {
      indicateur: axe.indicateur,
      cible: axe.repere,
      actuel: axe.valeur,
      recent,
      statut: atteint ? "atteint" : enProgres ? "en_bonne_voie" : "a_travailler",
      source: axe.source,
    };
  });
}

// ---------- Bilan ----------

/**
 * Bilan d'un format. `toutes` : les parties vérifiées du joueur ; `reperes` :
 * ceux du format (et du poste principal en 5v5), sans les parties du joueur,
 * vides si le site n'a pas encore assez de parties pour comparer.
 */
export function construireBilan(toutes: PartieBilan[], format: FormatBilan, reperes: Repere[]): Bilan {
  const parties = toutes
    .filter((p) => p.format === format)
    .sort((a, b) => a.joueLe.localeCompare(b.joueLe));
  const champions = lignesChampions(parties);
  // En 5v5 et en classée, on compare les parties du poste principal, à ses repères.
  const poste = format === "1v1" ? null : posteCompare(parties);
  const comparees = poste ? parties.filter((p) => p.poste === poste) : parties;
  const reperesUtilisables = format !== "1v1" && !poste ? [] : reperes;
  const pret = comparees.length >= PARTIES_MIN_BILAN;

  let comparaison: Bilan["comparaison"] = null;
  let forces: Constat[] = [];
  let axes: Constat[] = [];
  let auNiveau: CleIndicateur[] = [];
  let partiesRepere = 0;
  if (pret) {
    const auxVainqueurs = comparerAuxVainqueurs(comparees, format, reperesUtilisables);
    forces = meilleurs(auxVainqueurs.forces, 3);
    axes = meilleurs(auxVainqueurs.axes, 3);
    auNiveau = auxVainqueurs.auNiveau;
    partiesRepere = auxVainqueurs.partiesRepere;
    if (partiesRepere > 0) comparaison = "vainqueurs";
    // Rien d'assez net face aux vainqueurs : ce que disent tes propres parties.
    if (axes.length === 0) {
      axes = meilleurs(comparerATesParties(comparees, format), 3, new Set(forces.map((f) => f.indicateur)));
    }
    if (forces.length === 0) {
      forces = meilleurs(progres(comparees, format), 3, new Set(axes.map((a) => a.indicateur)));
    }
    if (comparaison === null && forces.length + axes.length > 0) comparaison = "tes_parties";
  }

  const solides = champions.filter((c) => c.parties >= 3);
  const championLePlusSolide =
    [...solides].sort(
      (a, b) => tauxPrudent(b.victoires, b.parties) - tauxPrudent(a.victoires, a.parties) || b.parties - a.parties,
    )[0] ?? null;

  return {
    format,
    parties: parties.length,
    victoires: parties.filter((p) => p.gagne).length,
    premiere: parties[0]?.joueLe ?? null,
    derniere: parties[parties.length - 1]?.joueLe ?? null,
    championPrincipal: champions[0]
      ? { champion: champions[0].champion, championId: champions[0].championId, parties: champions[0].parties }
      : null,
    postePrincipal: poste,
    partiesComparees: comparees.length,
    partiesManquantes: Math.max(0, PARTIES_MIN_BILAN - comparees.length),
    comparaison,
    partiesRepere,
    forces,
    axes,
    auNiveau,
    progression: pret
      ? INDICATEURS_PAR_FORMAT[format].flatMap((cle) => {
          const serie = serieProgression(comparees, cle, reperesUtilisables);
          return serie ? [serie] : [];
        })
      : [],
    champions,
    championLePlusSolide,
    plan: plan(comparees, axes),
  };
}

// ---------- Builds ----------

export interface ElementFrequent {
  valeur: string;
  parties: number;
  victoires: number;
  /** Part des parties (du joueur) ou des victoires (référence), entre 0 et 1. */
  part: number;
}

export interface BuildChampion {
  champion: string;
  championId: number | null;
  parties: number;
  victoires: number;
  joueur: { objets: ElementFrequent[]; runes: ElementFrequent[]; sorts: ElementFrequent[] };
  /** Ce que prennent les vainqueurs sur ce champion dans ce format, sur Najarena ; nul sous 10 parties. */
  reference: {
    parties: number;
    victoires: number;
    objets: ElementFrequent[];
    runes: ElementFrequent[];
    sorts: ElementFrequent[];
  } | null;
  aEssayer: { genre: "objet" | "rune"; valeur: string; partVainqueurs: number; partJoueur: number }[];
}

/** Une ligne de reperes_build (docs/schema.sql). */
export interface LigneReperesBuild {
  genre: string;
  valeur: string | null;
  parties: number;
  victoires: number;
}

function frequences(valeurs: { valeur: string; gagne: boolean }[], total: number): ElementFrequent[] {
  const compte = new Map<string, { parties: number; victoires: number }>();
  for (const { valeur, gagne } of valeurs) {
    const c = compte.get(valeur) ?? { parties: 0, victoires: 0 };
    c.parties += 1;
    if (gagne) c.victoires += 1;
    compte.set(valeur, c);
  }
  return [...compte.entries()]
    .map(([valeur, c]) => ({ valeur, ...c, part: total > 0 ? c.parties / total : 0 }))
    .sort((a, b) => b.parties - a.parties || b.victoires - a.victoires || a.valeur.localeCompare(b.valeur));
}

/**
 * Build d'un champion : ce que le joueur construit (objets de fin de
 * partie, rune principale, sorts) et, à partir de 10 parties vérifiées
 * d'autres joueurs sur ce champion dans le format, ce que prennent les
 * vainqueurs. `estObjetDeBuild` écarte potions, balises et autres
 * consommables.
 */
export function construireBuild(
  partiesJoueur: PartieBilan[],
  champion: string,
  reference: LigneReperesBuild[],
  estObjetDeBuild: (objet: number) => boolean = () => true,
): BuildChampion {
  const parties = partiesJoueur.filter((p) => p.champion === champion);
  const total = parties.length;
  const objets = frequences(
    parties.flatMap((p) =>
      [...new Set(p.objets)]
        .filter((o) => o > 0 && estObjetDeBuild(o))
        .map((o) => ({ valeur: String(o), gagne: p.gagne })),
    ),
    total,
  ).slice(0, 6);
  const runes = frequences(
    parties.flatMap((p) => (p.runePrincipale ? [{ valeur: String(p.runePrincipale), gagne: p.gagne }] : [])),
    total,
  );
  const sorts = frequences(
    parties.flatMap((p) =>
      p.sorts.length === 2 ? [{ valeur: [...p.sorts].sort((a, b) => a - b).join(","), gagne: p.gagne }] : [],
    ),
    total,
  );

  const totalReference = reference.find((r) => r.genre === "total");
  let ref: BuildChampion["reference"] = null;
  const aEssayer: BuildChampion["aEssayer"] = [];
  if (totalReference && totalReference.parties >= PARTIES_MIN_BUILD_REFERENCE && totalReference.victoires > 0) {
    const victoires = totalReference.victoires;
    const parGenre = (genre: string, filtre: (valeur: string) => boolean = () => true) =>
      reference
        .filter((r) => r.genre === genre && r.valeur !== null && r.victoires > 0 && filtre(r.valeur))
        .map((r) => ({
          valeur: r.valeur as string,
          parties: r.parties,
          victoires: r.victoires,
          part: r.victoires / victoires,
        }))
        .sort((a, b) => b.victoires - a.victoires || b.parties - a.parties || a.valeur.localeCompare(b.valeur));
    ref = {
      parties: totalReference.parties,
      victoires,
      objets: parGenre("objet", (v) => estObjetDeBuild(Number(v))).slice(0, 6),
      runes: parGenre("rune").slice(0, 3),
      sorts: parGenre("sorts").slice(0, 2),
    };
    // À essayer : ce que prennent au moins 40 % des vainqueurs, et le joueur
    // dans moins de 20 % de ses parties (2 parties au moins sur le champion).
    if (total >= 2) {
      for (const genre of ["objet", "rune"] as const) {
        const listeRef = genre === "objet" ? ref.objets : ref.runes;
        const listeJoueur = genre === "objet" ? objets : runes;
        for (const r of listeRef) {
          const partJoueur = (listeJoueur.find((j) => j.valeur === r.valeur)?.parties ?? 0) / total;
          if (r.part >= 0.4 && partJoueur < 0.2) {
            aEssayer.push({ genre, valeur: r.valeur, partVainqueurs: r.part, partJoueur });
          }
        }
      }
    }
  }

  return {
    champion,
    championId: parties.find((p) => p.championId !== null)?.championId ?? null,
    parties: total,
    victoires: parties.filter((p) => p.gagne).length,
    joueur: { objets, runes, sorts },
    reference: ref,
    aEssayer: aEssayer.sort((a, b) => b.partVainqueurs - a.partVainqueurs).slice(0, 3),
  };
}

// ---------- Lecture de la base ----------

/** Une ligne de la vue indicateurs_partie (docs/schema.sql). */
export interface LigneIndicateurs {
  match_id: string;
  format: string;
  champion: string;
  champion_id: number | null;
  poste: string | null;
  gagne: boolean;
  joue_le: string;
  kills: number;
  deaths: number;
  assists: number;
  kda: number | string | null;
  sbires_min: number | string | null;
  sbires_10: number | null;
  morts_10min: number | string | null;
  degats_min: number | string | null;
  or_min: number | string | null;
  vision_min: number | string | null;
  part_kills: number | string | null;
  part_degats: number | string | null;
  premier_sang: number | null;
  objets: number[] | null;
  rune_principale: number | null;
  style_secondaire: number | null;
  sorts: number[] | null;
}

/** Colonnes à lire dans la vue indicateurs_partie. */
export const COLONNES_INDICATEURS =
  "match_id, format, champion, champion_id, poste, gagne, joue_le, kills, deaths, assists, kda, sbires_min, sbires_10, morts_10min, degats_min, or_min, vision_min, part_kills, part_degats, premier_sang, objets, rune_principale, style_secondaire, sorts";

function nombre(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function partieDepuisLigne(l: LigneIndicateurs): PartieBilan | null {
  if (l.format !== "1v1" && l.format !== "5v5") return null;
  return {
    matchId: l.match_id,
    format: l.format,
    champion: l.champion,
    championId: l.champion_id,
    poste: l.poste,
    gagne: l.gagne,
    joueLe: l.joue_le,
    kills: l.kills,
    deaths: l.deaths,
    assists: l.assists,
    valeurs: {
      kda: nombre(l.kda),
      sbires_min: nombre(l.sbires_min),
      sbires_10: nombre(l.sbires_10),
      morts_10min: nombre(l.morts_10min),
      degats_min: nombre(l.degats_min),
      or_min: nombre(l.or_min),
      vision_min: nombre(l.vision_min),
      part_kills: nombre(l.part_kills),
      part_degats: nombre(l.part_degats),
      premier_sang: nombre(l.premier_sang),
    },
    objets: l.objets ?? [],
    runePrincipale: l.rune_principale,
    styleSecondaire: l.style_secondaire,
    sorts: l.sorts ?? [],
  };
}

/** Une ligne de la vue indicateurs_classees (docs/schema.sql, étape 2). */
export interface LigneIndicateursClassees {
  id: number;
  riot_match_id: string;
  file: number;
  palier: string | null;
  champion: string;
  champion_id: number | null;
  poste: string | null;
  gagne: boolean;
  joue_le: string;
  duree_secondes: number;
  equipe: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kda: number | string | null;
  sbires_min: number | string | null;
  sbires_10: number | null;
  morts_10min: number | string | null;
  degats_min: number | string | null;
  or_min: number | string | null;
  vision_min: number | string | null;
  part_kills: number | string | null;
  part_degats: number | string | null;
  premier_sang: number | null;
  ecart_or_15: number | null;
  morts_avant_10: number | null;
  objets: number[] | null;
  rune_principale: number | null;
  style_secondaire: number | null;
  sorts: number[] | null;
  morts_secondes: number[] | null;
  morts_x: number[] | null;
  morts_y: number[] | null;
}

/** Colonnes à lire dans la vue indicateurs_classees. */
export const COLONNES_INDICATEURS_CLASSEES =
  "id, riot_match_id, file, palier, champion, champion_id, poste, gagne, joue_le, duree_secondes, equipe, kills, deaths, assists, kda, sbires_min, sbires_10, morts_10min, degats_min, or_min, vision_min, part_kills, part_degats, premier_sang, ecart_or_15, morts_avant_10, objets, rune_principale, style_secondaire, sorts, morts_secondes, morts_x, morts_y";

export function partieClasseeDepuisLigne(l: LigneIndicateursClassees): PartieBilan {
  return {
    matchId: l.riot_match_id,
    format: "classees",
    champion: l.champion,
    championId: l.champion_id,
    poste: l.poste,
    gagne: l.gagne,
    joueLe: l.joue_le,
    kills: l.kills,
    deaths: l.deaths,
    assists: l.assists,
    valeurs: {
      kda: nombre(l.kda),
      sbires_min: nombre(l.sbires_min),
      sbires_10: nombre(l.sbires_10),
      morts_10min: nombre(l.morts_10min),
      degats_min: nombre(l.degats_min),
      or_min: nombre(l.or_min),
      vision_min: nombre(l.vision_min),
      part_kills: nombre(l.part_kills),
      part_degats: nombre(l.part_degats),
      premier_sang: nombre(l.premier_sang),
      ecart_or_15: nombre(l.ecart_or_15),
      morts_avant_10: nombre(l.morts_avant_10),
    },
    objets: l.objets ?? [],
    runePrincipale: l.rune_principale,
    styleSecondaire: l.style_secondaire,
    sorts: l.sorts ?? [],
  };
}

/** Une ligne de reperes_bilan (docs/schema.sql) ; nulle pour un indicateur que le bilan ne suit pas. */
export function repereDepuisLigne(l: {
  indicateur: string;
  parties: number;
  moyenne_gagnants: number | string | null;
  ecart_gagnants: number | string | null;
  moyenne_perdants: number | string | null;
  ecart_perdants: number | string | null;
}): Repere | null {
  if (!Object.hasOwn(INDICATEURS, l.indicateur)) return null;
  return {
    indicateur: l.indicateur as CleIndicateur,
    parties: l.parties,
    moyenneGagnants: nombre(l.moyenne_gagnants),
    ecartGagnants: nombre(l.ecart_gagnants),
    moyennePerdants: nombre(l.moyenne_perdants),
    ecartPerdants: nombre(l.ecart_perdants),
  };
}
