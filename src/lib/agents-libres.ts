// Agents libres (03/10/2026, audit N23) : les joueurs sans équipe
// s'inscrivent seuls à un tournoi 5v5 ; au lancement du bracket, le site
// forme des équipes de cinq équilibrées par rating et, autant que possible,
// sans doublon de rôle. Logique pure, testée dans agents-libres.test.ts ;
// la base vérifie et enregistre les équipes (former_equipes_agents_libres).

import { GLICKO_BASE } from "./glicko2";
import type { Role } from "./roles";
import { TAILLE_ALIGNEMENT } from "./cinq-contre-cinq";

export interface AgentLibre {
  profileId: string;
  /** Rating figé à l'inscription ; nul sans rating cette saison. */
  rating: number | null;
  role: Role | null;
}

export interface Formation {
  /** Équipes de cinq, capitaine (meilleur rating) en tête. */
  equipes: string[][];
  /** Agents sans place : pas assez pour une équipe de plus, ou plus de place. */
  restants: string[];
}

/** Écart de rating toléré pour échanger deux joueurs au nom des rôles. */
const ECART_ECHANGE = 100;

const valeur = (a: AgentLibre) => a.rating ?? GLICKO_BASE;

function doublonsDeRole(equipe: AgentLibre[]): number {
  const roles = equipe.flatMap((a) => (a.role ? [a.role] : []));
  return roles.length - new Set(roles).size;
}

/**
 * Forme les équipes. Les premiers inscrits sont servis en premier (ordre
 * reçu) ; parmi eux, répartition en serpentin par rating (1-2-3-3-2-1…),
 * puis échanges entre équipes de joueurs de niveau proche (±100) quand ils
 * réduisent les doublons de rôle. Déterministe : mêmes agents, mêmes
 * équipes.
 */
export function formerEquipes(agents: AgentLibre[], placesDisponibles: number): Formation {
  const nbEquipes = Math.max(0, Math.min(Math.floor(agents.length / TAILLE_ALIGNEMENT), placesDisponibles));
  const retenus = agents.slice(0, nbEquipes * TAILLE_ALIGNEMENT);
  const restants = agents.slice(nbEquipes * TAILLE_ALIGNEMENT).map((a) => a.profileId);
  if (nbEquipes === 0) return { equipes: [], restants: agents.map((a) => a.profileId) };

  // Serpentin : le meilleur va à l'équipe 1, le suivant à la 2… puis on
  // repart en sens inverse, pour des sommes de rating voisines.
  const parNiveau = [...retenus].sort((x, y) => valeur(y) - valeur(x) || x.profileId.localeCompare(y.profileId));
  const equipes: AgentLibre[][] = Array.from({ length: nbEquipes }, () => []);
  parNiveau.forEach((agent, i) => {
    const tour = Math.floor(i / nbEquipes);
    const position = i % nbEquipes;
    equipes[tour % 2 === 0 ? position : nbEquipes - 1 - position].push(agent);
  });

  // Rôles : un échange n'est gardé que s'il réduit le total des doublons.
  let ameliore = true;
  for (let passe = 0; ameliore && passe < 20; passe++) {
    ameliore = false;
    for (let e1 = 0; e1 < nbEquipes; e1++) {
      for (let e2 = e1 + 1; e2 < nbEquipes; e2++) {
        for (let i = 0; i < TAILLE_ALIGNEMENT; i++) {
          for (let j = 0; j < TAILLE_ALIGNEMENT; j++) {
            const a = equipes[e1][i];
            const b = equipes[e2][j];
            if (Math.abs(valeur(a) - valeur(b)) > ECART_ECHANGE || a.role === b.role) continue;
            const avant = doublonsDeRole(equipes[e1]) + doublonsDeRole(equipes[e2]);
            equipes[e1][i] = b;
            equipes[e2][j] = a;
            if (doublonsDeRole(equipes[e1]) + doublonsDeRole(equipes[e2]) < avant) {
              ameliore = true;
            } else {
              equipes[e1][i] = a;
              equipes[e2][j] = b;
            }
          }
        }
      }
    }
  }

  return {
    equipes: equipes.map((equipe) =>
      [...equipe].sort((x, y) => valeur(y) - valeur(x) || x.profileId.localeCompare(y.profileId)).map((a) => a.profileId),
    ),
    restants,
  };
}
