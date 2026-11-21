// Overlay de match pour les streams (21/11/2026, roadmap phase 4) : une
// bannière à placer dans OBS (source « navigateur »), qui montre les deux
// joueurs ou équipes, l'étape, l'état du match, puis le vainqueur et la
// source du verdict. Bâtie sur les widgets (/widget, sans script, rafraîchie
// toutes les minutes). Jamais de score en direct : le résultat d'une série
// n'existe qu'une fois lu chez Riot (ou tranché à la main, affiché
// « manuel ») — on n'invente jamais un résultat (CLAUDE.md §3).
// Logique pure, testée dans overlay-match.test.ts.

import { echapperHtml } from "@/lib/echappement";
import { tronquer } from "@/lib/bracket-image";
import { estTableau, libelleTourDouble } from "@/lib/double-elim";
import type { NiveauVerdict } from "@/lib/tournois";
import { pageWidget, PIED_RIOT, type OptionsWidget } from "@/lib/widgets";

/** Après le verdict, le résultat passe avant le match suivant pendant ce temps. */
export const RESULTAT_EN_AVANT_MINUTES = 15;
/** Au-delà, un résultat n'est plus affiché : « pas de match en cours ». */
export const DERNIER_RESULTAT_HEURES = 3;

export type StatutMatchOverlay = "en_attente" | "en_cours" | "termine" | "litige" | "forfait";

export interface CoteOverlay {
  nom: string;
  /** « Platine · 1623 » : joueur classé, en 1v1 seulement ; nul sinon. */
  niveau: string | null;
  /** S'est déclaré prêt (capitaine en 5v5). */
  pret: boolean;
}

export interface MatchOverlay {
  id: string;
  tournoi: string;
  /** « Demi-finale », « Ronde 2 », « Gagnants · tour 1 », « Duel »… */
  etape: string;
  bestOf: number;
  statut: StatutMatchOverlay;
  /** Dans l'ordre des places du match. */
  cotes: CoteOverlay[];
  /** Verdict définitif. `gagnant` : indice du côté vainqueur, nul sans vainqueur. */
  verdict: { niveau: NiveauVerdict; motif: string | null; gagnant: number | null } | null;
  urlPreuve: string;
}

/** Étape lisible d'un match, selon la nature et le format du tournoi. */
export function etapeMatch(
  tournoi: { nature: string; typeBracket: string },
  tour: number,
  tableau: string | null,
  dernierTour: number,
  toursGagnants: number,
): string {
  if (tournoi.nature === "defi") return "Duel";
  if (tournoi.nature === "scrim") return "Scrim";
  if (tournoi.typeBracket === "suisse") return `Ronde ${tour}`;
  if (estTableau(tableau)) return libelleTourDouble(tableau, tour, toursGagnants);
  const avantFinale = dernierTour - tour;
  if (avantFinale === 0) return "Finale";
  if (avantFinale === 1) return "Demi-finale";
  if (avantFinale === 2) return "Quart de finale";
  return `Tour ${tour}`;
}

/** Un match où le joueur est engagé (lui, ou son équipe en 5v5). */
export interface MatchCandidat {
  id: string;
  statut: StatutMatchOverlay;
  /** Le tournoi se joue en ce moment (statut « en_cours »). */
  tournoiEnCours: boolean;
  ouvertLe: string | null;
  /** Heure du verdict définitif, s'il y en a un. */
  verdictLe: string | null;
  adversaireConnu: boolean;
}

const temps = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

/**
 * Le match à montrer sur le stream d'un joueur : d'abord le match en cours
 * (ou en litige) ; sinon un résultat tombé il y a moins de 15 minutes ;
 * sinon le prochain match du tournoi en cours ; sinon le dernier résultat
 * des 3 dernières heures. Nul : rien à montrer.
 */
export function choisirMatchJoueur(candidats: MatchCandidat[], maintenant: Date): string | null {
  const recent = (iso: string | null, minutes: number) =>
    iso !== null && maintenant.getTime() - temps(iso) <= minutes * 60_000;
  const parOuverture = (a: MatchCandidat, b: MatchCandidat) => temps(b.ouvertLe) - temps(a.ouvertLe);
  const parVerdict = (a: MatchCandidat, b: MatchCandidat) => temps(b.verdictLe) - temps(a.verdictLe);

  const enJeu = candidats
    .filter((c) => c.tournoiEnCours && !c.verdictLe && (c.statut === "en_cours" || c.statut === "litige"))
    .sort(parOuverture);
  if (enJeu[0]) return enJeu[0].id;

  // Un résultat sans adversaire (exemption) n'est jamais mis en avant.
  const juste = candidats
    .filter((c) => c.adversaireConnu && recent(c.verdictLe, RESULTAT_EN_AVANT_MINUTES))
    .sort(parVerdict);
  if (juste[0]) return juste[0].id;

  const prochain = candidats
    .filter((c) => c.tournoiEnCours && !c.verdictLe && c.statut === "en_attente")
    .sort((a, b) => Number(b.adversaireConnu) - Number(a.adversaireConnu) || parOuverture(a, b));
  if (prochain[0]) return prochain[0].id;

  const dernier = candidats
    .filter((c) => c.adversaireConnu && recent(c.verdictLe, DERNIER_RESULTAT_HEURES * 60))
    .sort(parVerdict);
  return dernier[0]?.id ?? null;
}

function libelleEtat(m: MatchOverlay): string {
  if (m.verdict) return "Terminé";
  if (m.statut === "litige") return "En litige";
  if (m.statut === "en_cours") return "En cours";
  return m.cotes.length < 2 ? "En attente de l'adversaire" : "À venir";
}

function ligneVerdict(m: MatchOverlay): string {
  if (!m.verdict) {
    if (m.statut === "litige") return `<p class="overlay-bas muted">L'organisateur tranche le litige.</p>`;
    // Un match terminé ou forfait sans verdict définitif n'est pas annoncé.
    if (m.statut === "termine" || m.statut === "forfait") return "";
    return `<p class="overlay-bas muted">Résultat lu chez Riot après la partie.</p>`;
  }
  if (m.verdict.niveau !== "manuel") {
    const source = m.verdict.niveau === "code_tournoi" ? "code de tournoi Riot" : "partie lue dans l'historique Riot";
    return `<p class="overlay-bas"><span class="badge accent">✓ Vérifié</span> <span class="muted">· ${source}</span></p>`;
  }
  // Verdict manuel : jamais vert, jamais « vérifié », motif affiché.
  const motif = m.verdict.motif ? ` — ${echapperHtml(tronquer(m.verdict.motif, 110))}` : "";
  return `<p class="overlay-bas"><span class="badge">Manuel</span> <span class="muted">· décision de l'organisateur${motif}</span></p>`;
}

function cote(c: CoteOverlay | undefined, index: number, m: MatchOverlay): string {
  const droite = index === 1 ? " droite" : "";
  if (!c) return `<div class="cote${droite}"><p class="nom muted">À venir</p></div>`;
  const gagnant = m.verdict?.gagnant === index;
  const perdant = m.verdict !== null && m.verdict.gagnant !== null && !gagnant;
  const details = [
    c.niveau ? echapperHtml(c.niveau) : null,
    !m.verdict && m.statut === "en_cours" && c.pret ? "Prêt" : null,
    gagnant ? `<span class="vainqueur">Vainqueur</span>` : null,
  ].filter((x) => x !== null);
  return `<div class="cote${droite}${perdant ? " perdant" : ""}"><p class="nom">${echapperHtml(c.nom)}</p>${
    details.length > 0 ? `<p class="detail muted chiffre">${details.join(" · ")}</p>` : ""
  }</div>`;
}

/** Bannière d'un match. */
export function widgetMatch(m: MatchOverlay, options: OptionsWidget): string {
  const serie = m.bestOf > 1 ? ` · Bo${m.bestOf}` : "";
  const aucunVainqueur = m.verdict !== null && m.verdict.gagnant === null;
  const corps = `<div class="overlay">
<div class="overlay-haut"><h1 class="titre-tournoi">${echapperHtml(m.tournoi)}</h1><span class="muted">${echapperHtml(m.etape)}${serie}</span><span class="etat">${libelleEtat(m)}</span></div>
<div class="affiche">${cote(m.cotes[0], 0, m)}<span class="contre">contre</span>${cote(m.cotes[1], 1, m)}</div>
${aucunVainqueur ? `<p class="overlay-bas">Aucun vainqueur.</p>` : ""}${ligneVerdict(m)}
</div>`;
  return pageWidget(
    `${m.cotes.map((c) => c.nom).join(" contre ") || "Match"} — ${m.tournoi}`,
    corps,
    m.urlPreuve,
    options,
    m.verdict && m.verdict.niveau !== "manuel" ? PIED_RIOT : "Données Najarena",
  );
}

/** Bannière d'un joueur sans match à montrer. */
export function widgetSansMatch(pseudo: string, urlProfil: string, options: OptionsWidget): string {
  const corps = `<div class="overlay"><h1 class="nom">${echapperHtml(pseudo)}</h1><p class="muted">Pas de match en cours.</p></div>`;
  return pageWidget(pseudo, corps, urlProfil, options, "Données Najarena");
}
