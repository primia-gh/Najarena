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
import { pageWidget, PIED_NEUTRE, PIED_RIOT, type OptionsWidget } from "@/lib/widgets";

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
  /** Tournoi annulé : un match sans verdict ne se jouera pas. */
  tournoiAnnule: boolean;
  /** Dans l'ordre des places du match. */
  cotes: CoteOverlay[];
  /**
   * Verdict définitif. `gagnant` : indice du côté vainqueur (nul s'il n'est
   * pas retrouvé) ; `sansVainqueur` : verdict qui ne désigne personne
   * (double forfait). `decideur` d'un verdict manuel : l'organisateur,
   * l'arbitre (défi, scrim) ou une règle appliquée automatiquement (forfait
   * d'absence, exemption), comme sur la fiche de preuve.
   */
  verdict: {
    niveau: NiveauVerdict;
    motif: string | null;
    gagnant: number | null;
    sansVainqueur: boolean;
    decideur: "organisateur" | "arbitre" | "automatique";
  } | null;
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

/** État du match, repérable d'un coup d'œil (jamais en vert : « en cours » = match ouvert, pas une preuve). */
function etat(m: MatchOverlay): string {
  // Terminé sans verdict définitif : « Terminé », sans résultat annoncé.
  if (m.verdict || m.statut === "termine" || m.statut === "forfait") return `<span class="etat muted">Terminé</span>`;
  if (m.tournoiAnnule) return `<span class="etat muted">Tournoi annulé</span>`;
  if (m.statut === "litige") return `<span class="etat danger">En litige</span>`;
  if (m.statut === "en_cours")
    return `<span class="etat"><span class="point" aria-hidden="true"></span>En cours</span>`;
  return `<span class="etat muted">${m.cotes.length < 2 ? "En attente de l'adversaire" : "À venir"}</span>`;
}

const ORIGINE_MANUEL = {
  organisateur: "décision de l'organisateur",
  arbitre: "décision de l'arbitre",
  automatique: "appliqué automatiquement par Najarena",
} as const;

// Icône du verdict manuel, la même que sur le site (crayon, jamais vert).
const ICONE_MANUEL = `<svg class="icone" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

function ligneVerdict(m: MatchOverlay): string {
  if (!m.verdict) {
    // Tournoi annulé (duel, scrim sans partie retrouvée) : personne ne tranchera.
    if (m.tournoiAnnule) return "";
    if (m.statut === "litige") return `<p class="overlay-bas muted">L'organisateur tranche le litige.</p>`;
    // Un match terminé ou forfait sans verdict définitif n'est pas annoncé ;
    // sans adversaire, aucune partie ne peut encore se jouer.
    if (m.statut === "termine" || m.statut === "forfait" || m.tournoiAnnule || m.cotes.length < 2) return "";
    return `<p class="overlay-bas muted">Résultat lu chez Riot après la partie.</p>`;
  }
  if (m.verdict.niveau !== "manuel") {
    const source = m.verdict.niveau === "code_tournoi" ? "code de tournoi Riot" : "partie lue dans l'historique Riot";
    return `<p class="overlay-bas"><span class="badge accent">✓ Vérifié</span> <span class="muted">· ${source}</span></p>`;
  }
  // Verdict manuel : jamais vert, jamais « vérifié », motif affiché.
  const motif = m.verdict.motif ? ` — ${echapperHtml(tronquer(m.verdict.motif, 110))}` : "";
  const origine = ORIGINE_MANUEL[m.verdict.decideur];
  return `<p class="overlay-bas"><span class="badge muted">${ICONE_MANUEL}Manuel</span> <span class="muted">· ${origine}${motif}</span></p>`;
}

function cote(c: CoteOverlay | undefined, index: number, m: MatchOverlay): string {
  const droite = index === 1 ? " droite" : "";
  if (!c) return `<div class="cote${droite}"><p class="a-determiner muted">À déterminer</p></div>`;
  const gagnant = m.verdict?.gagnant === index;
  const perdant = m.verdict !== null && m.verdict.gagnant !== null && !gagnant;
  // Victoire : la lettre V et le mot, jamais la couleur seule (MASTER). Le
  // vert reste à la preuve : pastille grise pour un verdict manuel.
  const verifie = m.verdict !== null && m.verdict.niveau !== "manuel";
  const marque = gagnant ? `<span class="pastille-v${verifie ? "" : " neutre"}" aria-hidden="true">V</span>` : "";
  const details = [
    gagnant ? `<span class="vainqueur">Vainqueur</span>` : null,
    c.niveau ? echapperHtml(c.niveau) : null,
    !m.verdict && m.statut === "en_cours" && c.pret ? "Prêt" : null,
  ].filter((x) => x !== null);
  return `<div class="cote${droite}${perdant ? " perdant" : ""}"><div class="ligne-nom"><p class="nom">${echapperHtml(c.nom)}</p>${marque}</div>${
    details.length > 0 ? `<p class="detail muted chiffre">${details.join(" · ")}</p>` : ""
  }</div>`;
}

/** Bannière d'un match. */
export function widgetMatch(m: MatchOverlay, options: OptionsWidget): string {
  const serie = m.bestOf > 1 ? ` · Bo${m.bestOf}` : "";
  const aucunVainqueur = m.verdict !== null && m.verdict.sansVainqueur;
  const corps = `<div class="overlay">
<div class="overlay-haut"><h1 class="titre-tournoi">${echapperHtml(m.tournoi)}</h1><span class="muted">${echapperHtml(m.etape)}${serie}</span>${etat(m)}</div>
<div class="affiche">${cote(m.cotes[0], 0, m)}<span class="contre">contre</span>${cote(m.cotes[1], 1, m)}</div>
${aucunVainqueur ? `<p class="overlay-bas">Aucun vainqueur.</p>` : ""}${ligneVerdict(m)}
</div>`;
  return pageWidget(
    `${m.cotes.map((c) => c.nom).join(" contre ") || "Match"} — ${m.tournoi}`,
    corps,
    m.urlPreuve,
    options,
    m.verdict && m.verdict.niveau !== "manuel" ? PIED_RIOT : PIED_NEUTRE,
  );
}

/** Joueur sans match à montrer : une ligne discrète, l'overlay reste dans OBS entre deux matchs. */
export function widgetSansMatch(pseudo: string, urlProfil: string, options: OptionsWidget): string {
  const corps = `<div class="overlay overlay-vide"><h1 class="muted"><span class="titre-tournoi">${echapperHtml(pseudo)}</span> · pas de match en cours</h1></div>`;
  return pageWidget(pseudo, corps, urlProfil, options, PIED_NEUTRE);
}
