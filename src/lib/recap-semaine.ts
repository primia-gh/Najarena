import { ajouterJours, instantParis, jourParis } from "@/lib/tournois-auto/creneaux";
import { progressionPalier, type Palier } from "@/lib/classement";
import { probabiliteVictoire } from "@/lib/glicko2";
import { ETAT_DE_DEPART, SEUIL_EXPLOIT, type EtatRating } from "@/lib/estimations";

// Récap de la semaine (28/09/2026, audit N17) : chaque lundi, ce que les
// tournois clôturés de la semaine précédente ont changé — plus fortes
// progressions, exploit, nouveaux paliers, joueurs les plus actifs. Tiré
// du journal des points et des matchs vérifiés, rien d'autre. Logique pure,
// testée dans recap-semaine.test.ts.

/** Lundi (AAAA-MM-JJ, heure de Paris) de la semaine qui contient cet instant. */
export function lundiDeLaSemaine(instant: Date): string {
  const jour = jourParis(instant);
  const [a, m, j] = jour.split("-").map(Number);
  const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay(); // 0 = dimanche
  return ajouterJours(jour, -((jourSemaine + 6) % 7));
}

export function estUnLundi(jour: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false;
  const [a, m, j] = jour.split("-").map(Number);
  const date = new Date(Date.UTC(a, m - 1, j));
  return date.getUTCDay() === 1 && date.toISOString().slice(0, 10) === jour;
}

/** Du lundi 00:00 au lundi suivant 00:00, heure de Paris. */
export function bornesSemaine(lundi: string): { debut: Date; fin: Date } {
  return { debut: instantParis(lundi, "00:00"), fin: instantParis(ajouterJours(lundi, 7), "00:00") };
}

export interface VariationRecap {
  profileId: string;
  tournoiId: string;
  avant: number;
  rdAvant: number;
  apres: number;
  rdApres: number;
  le: string;
}

export interface MatchRecapSemaine {
  tournoiId: string;
  joueurs: string[];
  gagnantId: string;
}

export interface RecapSemaine {
  tournois: number;
  matchsVerifies: number;
  progressions: { profileId: string; gain: number }[];
  exploit: { gagnantId: string; perdantId: string; chances: number; tournoiId: string } | null;
  nouveauxPaliers: { profileId: string; palier: string }[];
  actifs: { profileId: string; matchs: number }[];
}

const RANG_PALIER = (paliers: Palier[], nom: string | undefined) =>
  nom ? [...paliers].sort((a, b) => a.ratingMin - b.ratingMin).findIndex((p) => p.nom === nom) : -1;

/**
 * Récap d'une semaine à partir des variations de points (motif « tournoi »)
 * et des matchs vérifiés (niveaux 2 et 3) des tournois clôturés pendant la
 * semaine. Null s'il n'y en a aucun : on ne publie jamais une semaine vide.
 */
export function construireRecap(
  variations: VariationRecap[],
  matchs: MatchRecapSemaine[],
  paliers: Palier[],
): RecapSemaine | null {
  const tournois = new Set(variations.map((v) => v.tournoiId));
  if (tournois.size === 0) return null;

  // Progressions : somme des variations de la semaine, par joueur.
  const gains = new Map<string, number>();
  for (const v of variations) gains.set(v.profileId, (gains.get(v.profileId) ?? 0) + (v.apres - v.avant));
  const progressions = [...gains]
    .filter(([, gain]) => gain > 0)
    .map(([profileId, gain]) => ({ profileId, gain: Math.round(gain) }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);

  // Nouveaux paliers : palier de fin de semaine au-dessus de celui du début,
  // annoncé seulement pour un joueur classé (RD ≤ 150) en fin de semaine.
  const parJoueur = new Map<string, VariationRecap[]>();
  for (const v of variations) parJoueur.set(v.profileId, [...(parJoueur.get(v.profileId) ?? []), v]);
  const nouveauxPaliers: { profileId: string; palier: string }[] = [];
  for (const [profileId, liste] of parJoueur) {
    const triee = [...liste].sort((a, b) => a.le.localeCompare(b.le));
    const premiere = triee[0];
    const derniere = triee[triee.length - 1];
    if (derniere.rdApres > 150) continue;
    const avant = progressionPalier(premiere.avant, paliers).palier?.nom;
    const apres = progressionPalier(derniere.apres, paliers).palier?.nom;
    if (apres && RANG_PALIER(paliers, apres) > RANG_PALIER(paliers, avant)) nouveauxPaliers.push({ profileId, palier: apres });
  }

  // Exploit : la victoire vérifiée la moins probable, d'après le rating de
  // chacun au début de son tournoi (journal des points).
  const depart = new Map<string, EtatRating>(
    variations.map((v) => [`${v.tournoiId}|${v.profileId}`, { rating: v.avant, rd: v.rdAvant }]),
  );
  const etat = (tournoiId: string, id: string) => depart.get(`${tournoiId}|${id}`) ?? ETAT_DE_DEPART;
  let exploit: RecapSemaine["exploit"] = null;
  const nbMatchs = new Map<string, number>();
  for (const m of matchs) {
    m.joueurs.forEach((id) => nbMatchs.set(id, (nbMatchs.get(id) ?? 0) + 1));
    const perdantId = m.joueurs.find((id) => id !== m.gagnantId);
    if (!perdantId || m.joueurs.length !== 2) continue;
    const p = probabiliteVictoire(etat(m.tournoiId, m.gagnantId), etat(m.tournoiId, perdantId));
    if (p < SEUIL_EXPLOIT && (!exploit || p < exploit.chances)) {
      exploit = { gagnantId: m.gagnantId, perdantId, chances: p, tournoiId: m.tournoiId };
    }
  }

  const actifs = [...nbMatchs]
    .map(([profileId, n]) => ({ profileId, matchs: n }))
    .sort((a, b) => b.matchs - a.matchs)
    .slice(0, 3);

  return {
    tournois: tournois.size,
    matchsVerifies: matchs.length,
    progressions,
    exploit: exploit ? { ...exploit, chances: Math.round(exploit.chances * 100) } : null,
    nouveauxPaliers,
    actifs,
  };
}

/** Message Discord du lundi (noms déjà échappés par l'appelant). */
export function messageRecap(recap: RecapSemaine, nom: (id: string) => string, lien: string): string {
  const lignes = [
    `📊 **Récap de la semaine** — ${recap.tournois} tournoi${recap.tournois > 1 ? "s" : ""} clôturé${recap.tournois > 1 ? "s" : ""}, ${recap.matchsVerifies} match${recap.matchsVerifies > 1 ? "s" : ""} vérifié${recap.matchsVerifies > 1 ? "s" : ""}.`,
  ];
  if (recap.progressions.length > 0) {
    lignes.push(`Plus fortes progressions : ${recap.progressions.map((p) => `${nom(p.profileId)} (+${p.gain})`).join(", ")}.`);
  }
  if (recap.exploit) {
    lignes.push(
      `Exploit : ${nom(recap.exploit.gagnantId)} (${recap.exploit.chances} % de chances) bat ${nom(recap.exploit.perdantId)}.`,
    );
  }
  if (recap.nouveauxPaliers.length > 0) {
    lignes.push(`Nouveaux paliers : ${recap.nouveauxPaliers.map((p) => `${nom(p.profileId)} → ${p.palier}`).join(", ")}.`);
  }
  lignes.push(lien);
  return lignes.join("\n");
}
