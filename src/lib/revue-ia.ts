// Revue de match détaillée, rédigée par l'IA (03/10/2026, audit N25) —
// offre Elite. Complète la revue à base de règles (src/lib/revue-match.ts) :
// mêmes chiffres officiels (lus chez Riot pendant le rapprochement), mis en
// perspective avec l'adversaire et les moyennes du joueur. L'IA ne connaît
// pas le déroulé de la partie (pas de chronologie avec la clé de
// développement) et a pour consigne de ne rien inventer au-delà des
// chiffres fournis. Logique pure, testée dans revue-ia.test.ts.

import type { Moyennes, StatsMatch } from "./revue-match";
import { listeDeTextes } from "./claude";

export interface DonneesRevueIA {
  format: string;
  moi: StatsMatch;
  adversaire: StatsMatch | null;
  moyennesVictoires: Moyennes | null;
  moyennesDefaites: Moyennes | null;
}

export interface RevueIA {
  points: string[];
  conseil: string;
}

export const SCHEMA_REVUE = {
  type: "object",
  properties: {
    points: { type: "array", items: { type: "string" } },
    conseil: { type: "string" },
  },
  required: ["points", "conseil"],
  additionalProperties: false,
};

const SYSTEME_REVUE = `Tu es analyste League of Legends pour Najarena, une plateforme de tournois dont les résultats sont lus dans la donnée officielle Riot.
On te donne les statistiques officielles d'un joueur pour une partie de tournoi, celles de son adversaire quand il y en a un, et ses moyennes sur ses autres parties vérifiées.
Écris en français, en tutoyant le joueur :
- "points" : 2 à 4 constats courts (une ou deux phrases chacun), chacun appuyé sur un chiffre fourni ;
- "conseil" : un seul conseil concret pour sa prochaine partie.
Règles strictes : n'utilise que les chiffres fournis. Tu ne connais ni le déroulé de la partie, ni les objets, ni les objectifs, ni les combats : ne les évoque pas et n'invente rien. Pas de note sur 100, pas de jugement sur la personne. Si les données sont trop minces pour un constat, dis-le simplement.`;

function duree(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  return `${minutes} min ${String(secondes % 60).padStart(2, "0")} s`;
}

function parMinute(valeur: number, secondes: number): string {
  return secondes > 0 ? (valeur / (secondes / 60)).toFixed(1) : "—";
}

function ligneStats(titre: string, s: StatsMatch): string {
  return `${titre} : ${s.champion}, ${s.gagne ? "victoire" : "défaite"}, ${s.kills}/${s.deaths}/${s.assists} (K/D/A), ${s.cs} sbires (${parMinute(s.cs, s.dureeSecondes)} par minute), ${s.orGagne} pièces d'or (${parMinute(s.orGagne, s.dureeSecondes)} par minute)`;
}

function ligneMoyennes(titre: string, m: Moyennes | null): string {
  if (!m) return `${titre} : pas encore assez de parties vérifiées pour une moyenne.`;
  return `${titre} (${m.nombreMatchs} parties) : ${m.kills.toFixed(1)}/${m.deaths.toFixed(1)}/${m.assists.toFixed(1)} (K/D/A), ${m.cs.toFixed(0)} sbires, ${m.orGagne.toFixed(0)} pièces d'or`;
}

/** Système et contenu de la demande ; les chiffres seuls, mis en forme. */
export function construireDemandeRevue(d: DonneesRevueIA): { systeme: string; contenu: string } {
  const lignes = [
    `Format : ${d.format}, durée de la partie ${duree(d.moi.dureeSecondes)}.`,
    ligneStats("Le joueur", d.moi),
    d.adversaire ? ligneStats("Son adversaire", d.adversaire) : "Adversaire : statistiques indisponibles.",
    ligneMoyennes("Moyennes du joueur dans ses victoires", d.moyennesVictoires),
    ligneMoyennes("Moyennes du joueur dans ses défaites", d.moyennesDefaites),
  ];
  return { systeme: SYSTEME_REVUE, contenu: lignes.join("\n") };
}

/** Réponse acceptée seulement si elle a la forme attendue, en longueurs raisonnables. */
export function validerRevue(donnees: unknown): RevueIA | null {
  if (typeof donnees !== "object" || donnees === null) return null;
  const { points, conseil } = donnees as { points?: unknown; conseil?: unknown };
  const constats = listeDeTextes(points, 1, 4, 400);
  if (!constats || typeof conseil !== "string") return null;
  const leConseil = conseil.trim();
  return leConseil.length > 0 && leConseil.length <= 400 ? { points: constats, conseil: leConseil } : null;
}
