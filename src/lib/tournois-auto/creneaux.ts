// Tournois automatiques (24/09/2026) — configuration des créneaux
// quotidiens et calcul des heures en heure de Paris. Logique pure (aucun
// accès base de données), testée dans creneaux.test.ts.
//
// CLAUDE.md §10 : la précision du classement dépend du nombre de matchs
// par joueur. On ouvre de nouveaux créneaux au fur et à mesure de la
// croissance (≈ 15 joueurs actifs par place et par jour) plutôt que
// d'entasser tout le monde sur un seul tournoi : ajouter un créneau =
// ajouter une ligne à CRENEAUX, rien d'autre.

export const FUSEAU_PARIS = "Europe/Paris";

export interface Creneau {
  // Identifiant stable, écrit dans tournaments.creneau_auto — ne jamais
  // renommer un créneau existant (le tournoi du jour serait recréé).
  cle: string;
  nom: string;
  // Heure de début, heure de Paris (le passage heure d'été / heure
  // d'hiver est géré par instantParis).
  heure: string;
  // Ouverture du check-in, en minutes avant le début.
  checkinMinutes: number;
  capacite: 4 | 8 | 16 | 32 | 64;
  bestOf: 1;
  region: string;
  // En dessous, le tournoi est annulé à l'heure du début : un bracket à
  // 2 ou 3 joueurs n'est pas un tournoi.
  minimumJoueurs: number;
}

export const CRENEAUX: readonly Creneau[] = [
  {
    cle: "quotidien-21h",
    nom: "Najarena Daily",
    heure: "21:00",
    checkinMinutes: 30,
    capacite: 16,
    bestOf: 1,
    region: "EUW",
    minimumJoueurs: 4,
  },
];

// Les tournois sont créés pour aujourd'hui et demain : il y a toujours un
// tournoi ouvert aux inscriptions, même juste après le début de celui du
// soir.
export const JOURS_D_AVANCE = 2;

// Annonce du tournoi du jour sur le salon Discord, quelques heures avant
// le début (15:00 pour un tournoi à 21:00) — le tournoi est créé bien plus
// tôt (JOURS_D_AVANCE), une annonce au moment de sa création tomberait
// en pleine nuit.
export const ANNONCE_HEURES_AVANT = 6;

// Second rappel, envoyé aux joueurs qui n'ont toujours pas fait leur
// check-in.
export const DERNIER_APPEL_MINUTES = 10;

// Si le démarrage automatique n'a pas pu avoir lieu dans ce délai (tâche
// planifiée en panne), le tournoi est annulé plutôt que lancé des heures
// plus tard devant des joueurs partis.
export const RETARD_MAX_DEMARRAGE_MINUTES = 120;

export function trouverCreneau(cle: string | null): Creneau | undefined {
  return cle ? CRENEAUX.find((c) => c.cle === cle) : undefined;
}

// Décalage (en minutes) entre l'heure de Paris et l'heure UTC à un
// instant donné : +120 en été, +60 en hiver.
function decalageParisMinutes(instant: Date): number {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU_PARIS,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const valeur = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parties.find((p) => p.type === type)?.value ?? 0);
  const commeSiUtc = Date.UTC(
    valeur("year"),
    valeur("month") - 1,
    valeur("day"),
    valeur("hour"),
    valeur("minute"),
    valeur("second"),
  );
  return Math.round((commeSiUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Instant réel correspondant à « tel jour, telle heure, à Paris ». */
export function instantParis(jour: string, heure: string): Date {
  const [annee, mois, j] = jour.split("-").map(Number);
  const [h, min] = heure.split(":").map(Number);
  const naif = Date.UTC(annee, mois - 1, j, h, min);
  // Deux passes : le décalage dépend de l'instant qu'on cherche, qui peut
  // tomber de l'autre côté d'un changement d'heure que le premier essai.
  const essai = naif - decalageParisMinutes(new Date(naif)) * 60000;
  return new Date(naif - decalageParisMinutes(new Date(essai)) * 60000);
}

/** Jour calendaire à Paris (« 2026-09-24 ») d'un instant donné. */
export function jourParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU_PARIS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function ajouterJours(jour: string, nombre: number): string {
  const [annee, mois, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(annee, mois - 1, j + nombre)).toISOString().slice(0, 10);
}

/** « 21:00 » — heure de Paris, pour les messages envoyés aux joueurs. */
export function heureParis(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_PARIS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** « jeudi 25/09 » — jour de Paris, pour les annonces. */
export function jourLisibleParis(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_PARIS,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

export function nomTournoi(creneau: Creneau, jour: string): string {
  const [, mois, j] = jour.split("-");
  return `${creneau.nom} · ${j}/${mois}`;
}

export function slugTournoi(creneau: Creneau, jour: string): string {
  return `najarena-${creneau.cle}-${jour}`;
}

/**
 * Taille du bracket au démarrage : la plus petite puissance de 2 qui
 * contient tous les joueurs confirmés (4 au minimum, jamais plus que la
 * capacité annoncée). Même nombre de vrais matchs qu'avec la capacité
 * annoncée (toujours joueurs − 1), mais sans tours entiers de places
 * vides à l'affichage.
 */
export function capaciteEffective(nbJoueurs: number, capaciteAnnoncee: number): number {
  let capacite = 4;
  while (capacite < nbJoueurs && capacite < capaciteAnnoncee) capacite *= 2;
  return Math.min(capacite, Math.max(capaciteAnnoncee, 4));
}
