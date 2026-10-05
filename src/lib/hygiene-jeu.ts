import { FUSEAU_PARIS } from "./tournois-auto/creneaux";

// Hygiène de jeu (bilan du joueur, étape 2, 05/10/2026) : les résultats en
// classée selon l'enchaînement des parties, ce qui suit une défaite et
// l'heure de la journée — et, quand l'écart est net, une règle d'arrêt
// personnelle. C'est un des conseils qui fait le plus gagner, sans demander
// aucun talent. Logique pure, testée.

/** Deux parties séparées de moins de 30 minutes font partie de la même session. */
export const ECART_SESSION_MINUTES = 30;
export const PARTIES_MIN_HYGIENE = 20;
/** Parties qu'il faut dans une situation pour en tirer une règle. */
export const PARTIES_MIN_REGLE = 10;
const ECART_MIN_REGLE = 0.1;

export interface PartieHorodatee {
  joueLe: string;
  dureeSecondes: number;
  gagne: boolean;
}

export interface Situation {
  cle: string;
  libelle: string;
  parties: number;
  victoires: number;
  taux: number;
}

export interface RegleArret {
  situation: Situation;
  texte: string;
}

export interface Hygiene {
  parties: number;
  victoires: number;
  taux: number;
  sessions: number;
  partiesParSession: number;
  apresDefaites: Situation[];
  rangDansSession: Situation[];
  momentDeJournee: Situation[];
  regles: RegleArret[];
}

const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", hourCycle: "h23", timeZone: FUSEAU_PARIS });

/** Heure de Paris (0 à 23) du début d'une partie. */
export function heureDeParis(iso: string): number {
  return Number(HEURE.formatToParts(new Date(iso)).find((p) => p.type === "hour")?.value ?? Number.NaN);
}

function moment(heure: number): "matin" | "apres_midi" | "soir" | "nuit" {
  if (heure >= 6 && heure < 12) return "matin";
  if (heure >= 12 && heure < 18) return "apres_midi";
  if (heure >= 18 && heure < 23) return "soir";
  return "nuit";
}

const LIBELLE_MOMENT = {
  matin: "Le matin (6 h – 12 h)",
  apres_midi: "L'après-midi (12 h – 18 h)",
  soir: "Le soir (18 h – 23 h)",
  nuit: "La nuit (après 23 h)",
} as const;

/** Borne haute de Wilson (z = 1) : le meilleur taux que les parties laissent espérer. */
function tauxHaut(victoires: number, parties: number): number {
  const p = victoires / parties;
  const denominateur = 1 + 1 / parties;
  const centre = p + 1 / (2 * parties);
  const marge = Math.sqrt((p * (1 - p)) / parties + 1 / (4 * parties * parties));
  return (centre + marge) / denominateur;
}

function situation(cle: string, libelle: string, parties: PartieHorodatee[]): Situation {
  const victoires = parties.filter((p) => p.gagne).length;
  return { cle, libelle, parties: parties.length, victoires, taux: parties.length > 0 ? victoires / parties.length : 0 };
}

export function hygieneDeJeu(toutes: PartieHorodatee[]): Hygiene | null {
  const parties = [...toutes].sort((a, b) => a.joueLe.localeCompare(b.joueLe));
  if (parties.length < PARTIES_MIN_HYGIENE) return null;

  // Sessions, rang de chaque partie dans sa session, défaites qui la précèdent.
  const rangs: number[] = [];
  const defaitesAvant: number[] = [];
  let sessions = 0;
  parties.forEach((p, i) => {
    const precedente = parties[i - 1];
    const finPrecedente = precedente ? new Date(precedente.joueLe).getTime() + precedente.dureeSecondes * 1000 : null;
    const nouvelle =
      finPrecedente === null || new Date(p.joueLe).getTime() - finPrecedente > ECART_SESSION_MINUTES * 60_000;
    if (nouvelle) sessions += 1;
    rangs.push(nouvelle ? 1 : rangs[i - 1] + 1);
    defaitesAvant.push(nouvelle || !precedente || precedente.gagne ? 0 : defaitesAvant[i - 1] + 1);
  });

  const global = situation("toutes", "Toutes tes parties", parties);
  const filtre = (condition: (i: number) => boolean) => parties.filter((_, i) => condition(i));
  const apresDefaites = [
    situation("0", "Après une victoire ou en début de session", filtre((i) => defaitesAvant[i] === 0)),
    situation("1", "Après une défaite", filtre((i) => defaitesAvant[i] === 1)),
    situation("2+", "Après 2 défaites d'affilée ou plus", filtre((i) => defaitesAvant[i] >= 2)),
  ];
  const rangDansSession = [
    situation("1-2", "1re et 2e partie d'une session", filtre((i) => rangs[i] <= 2)),
    situation("3", "3e partie", filtre((i) => rangs[i] === 3)),
    situation("4+", "4e partie et au-delà", filtre((i) => rangs[i] >= 4)),
  ];
  const momentDeJournee = (["matin", "apres_midi", "soir", "nuit"] as const).map((m) =>
    situation(m, LIBELLE_MOMENT[m], filtre((i) => moment(heureDeParis(parties[i].joueLe)) === m)),
  );

  // Une règle seulement si l'écart est net : 10 parties au moins, 10 points
  // de moins qu'en général, et même le meilleur taux possible reste en dessous.
  const nette = (s: Situation) =>
    s.parties >= PARTIES_MIN_REGLE && s.taux <= global.taux - ECART_MIN_REGLE && tauxHaut(s.victoires, s.parties) < global.taux;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const constat = (s: Situation) =>
    `tu gagnes ${pct(s.taux)} de tes parties (sur ${s.parties}), contre ${pct(global.taux)} en général`;
  const regles: RegleArret[] = [];
  const [, uneDefaite, deuxDefaites] = apresDefaites;
  if (nette(deuxDefaites)) {
    regles.push({ situation: deuxDefaites, texte: `Après 2 défaites d'affilée, ${constat(deuxDefaites)} : arrête-toi après 2 défaites.` });
  } else if (nette(uneDefaite)) {
    regles.push({ situation: uneDefaite, texte: `Après une défaite, ${constat(uneDefaite)} : fais une vraie pause avant de relancer.` });
  }
  const longue = rangDansSession[2];
  if (nette(longue)) {
    regles.push({ situation: longue, texte: `À partir de la 4e partie d'affilée, ${constat(longue)} : limite tes sessions à 3 parties.` });
  }
  for (const s of momentDeJournee) {
    if (nette(s)) regles.push({ situation: s, texte: `${s.libelle}, ${constat(s)} : joue tes classées à un autre moment.` });
  }

  return {
    parties: global.parties,
    victoires: global.victoires,
    taux: global.taux,
    sessions,
    partiesParSession: parties.length / sessions,
    apresDefaites,
    rangDansSession,
    momentDeJournee,
    regles,
  };
}
