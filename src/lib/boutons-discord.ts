// Boutons des messages privés Discord (09/10/2026, idée en réserve n°10) :
// « Je confirme ma présence », « Je suis prêt », « Accepter » / « Refuser »
// un défi, « Proposer une revanche ». Logique pure (testée dans
// boutons-discord.test.ts) : identifiant de chaque bouton, mise en forme
// pour l'API Discord, textes de réponse. Le clic lui-même est traité par
// /api/discord/interactions, qui passe par la fonction de base
// agir_depuis_discord : mêmes règles que sur le site.

import { DELAI_FORFAIT_MINUTES } from "@/lib/forfait";
import { messageRefusDefi } from "@/lib/defis";

export const ACTIONS_BOUTON = ["checkin", "pret", "defi_oui", "defi_non", "revanche"] as const;
export type ActionBouton = (typeof ACTIONS_BOUTON)[number];

export interface BoutonDiscord {
  action: ActionBouton;
  /** Tournoi (check-in), match (prêt), défi (réponse) ou duel joué (revanche). */
  cible: string;
  libelle: string;
  style?: "principal" | "secondaire" | "danger";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant porté par le bouton (custom_id, 100 caractères au plus chez Discord). */
export function idBouton(action: ActionBouton, cible: string): string {
  return `${action}:${cible}`;
}

/** Relit l'identifiant d'un bouton cliqué ; null s'il n'est pas l'un des nôtres. */
export function lireIdBouton(customId: string | undefined): { action: ActionBouton; cible: string } | null {
  if (!customId) return null;
  const [action, cible, ...reste] = customId.split(":");
  if (reste.length > 0 || !cible || !UUID.test(cible)) return null;
  if (!(ACTIONS_BOUTON as readonly string[]).includes(action)) return null;
  return { action: action as ActionBouton, cible: cible.toLowerCase() };
}

// Styles de bouton de l'API Discord.
const STYLE = { principal: 1, secondaire: 2, danger: 4 } as const;
const STYLE_LIEN = 5;

export interface ComposantBouton {
  type: 2;
  style: number;
  label: string;
  custom_id?: string;
  url?: string;
}
export interface LigneComposants {
  type: 1;
  components: ComposantBouton[];
}

/**
 * Boutons d'un message, plus un bouton-lien vers la page du site. Une ligne
 * Discord tient 5 boutons au plus : au-delà, ils passent à la ligne.
 */
export function composantsDiscord(
  boutons: BoutonDiscord[],
  lien?: { libelle: string; url: string },
): LigneComposants[] {
  const tous: ComposantBouton[] = [
    ...boutons.map((b) => ({
      type: 2 as const,
      style: STYLE[b.style ?? "principal"],
      label: b.libelle.slice(0, 80),
      custom_id: idBouton(b.action, b.cible),
    })),
    ...(lien && /^https:\/\//.test(lien.url)
      ? [{ type: 2 as const, style: STYLE_LIEN, label: lien.libelle.slice(0, 80), url: lien.url }]
      : []),
  ];
  const lignes: LigneComposants[] = [];
  for (let i = 0; i < tous.length; i += 5) lignes.push({ type: 1, components: tous.slice(i, i + 5) });
  return lignes;
}

/**
 * Un clic signé il y a plus de 5 minutes est refusé : une requête captée
 * puis rejouée plus tard n'agit pas (la signature Discord couvre l'heure).
 */
export function horodatageRecent(timestamp: string | null, maintenantMs: number, toleranceSecondes = 300): boolean {
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;
  return Math.abs(maintenantMs / 1000 - Number(timestamp)) <= toleranceSecondes;
}

const REFUS_COMMUNS: Record<string, string> = {
  COMPTE_DISCORD_INCONNU:
    "Ce compte Discord n'est lié à aucun compte Najarena. Connecte-toi au site avec Discord pour utiliser ces boutons.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : action impossible.",
  ACTION_INCONNUE: "Ce bouton n'est plus valable.",
};

const REFUS_CHECKIN: Record<string, string> = {
  CHECKIN_FERME: "Le check-in n'est pas ouvert pour ce tournoi.",
  TOURNOI_INTROUVABLE: "Ce tournoi n'existe plus.",
  ALIGNEMENT_INCOMPLET:
    "Ton alignement n'a plus cinq joueurs : complète-le sur le site avant de confirmer la présence de l'équipe.",
};

const REFUS_PRET: Record<string, string> = {
  NON_PARTICIPANT: "Tu ne joues pas ce match.",
  ADVERSAIRE_ABSENT: "Ton adversaire n'est pas encore connu.",
  MATCH_NON_OUVERT: "Ce match n'est plus à jouer.",
  MATCH_INTROUVABLE: "Ce match n'existe pas.",
};

function chercher(table: Record<string, string>, erreur: string): string | null {
  const code = Object.keys(table).find((c) => erreur.includes(c));
  return code ? table[code] : null;
}

/** Texte d'un refus de la base, selon le bouton cliqué. */
export function messageRefusBouton(action: ActionBouton, erreur: string): string {
  const commun = chercher(REFUS_COMMUNS, erreur);
  if (commun) return commun;
  if (action === "checkin") return chercher(REFUS_CHECKIN, erreur) ?? "Impossible de confirmer ta présence pour l'instant.";
  if (action === "pret") return chercher(REFUS_PRET, erreur) ?? "Impossible de te déclarer prêt pour l'instant.";
  if (action === "revanche" && erreur.includes("NON_PARTICIPANT")) return "Tu n'as pas joué ce duel.";
  return messageRefusDefi(erreur, "Impossible de répondre pour l'instant : réessaie depuis le site.");
}

/** Ce que renvoie la base après un clic accepté. */
export interface ResultatBouton {
  ok?: boolean;
  nouveau?: boolean;
  slug?: string | null;
}

/**
 * Texte ajouté sous le message après un clic accepté ; null quand il n'y
 * avait rien à faire (le clic est alors traité comme un refus).
 */
export function messageReussiteBouton(
  action: ActionBouton,
  resultat: ResultatBouton,
  details: { adversairePret?: boolean; adversaire?: string } = {},
): string | null {
  switch (action) {
    case "checkin":
      return resultat.ok ? "Présence confirmée." : null;
    case "pret":
      if (details.adversairePret) return "Vous êtes prêts tous les deux : lancez la partie.";
      return resultat.nouveau
        ? `Tu es prêt. Si ton adversaire ne l'est pas dans les ${DELAI_FORFAIT_MINUTES} minutes, il perd par forfait.`
        : "Tu étais déjà déclaré prêt.";
    case "defi_oui":
      return "Défi accepté : le duel est ouvert. Déclare-toi prêt quand tu es en ligne.";
    case "defi_non":
      return "Défi refusé.";
    case "revanche":
      return `Revanche proposée${details.adversaire ? ` à ${details.adversaire}` : ""} : réponse attendue dans les 24 h.`;
  }
}

/** Refus quand le clic n'avait rien à faire (check-in déjà fait, pas d'inscription). */
export const RIEN_A_CONFIRMER = "Aucune inscription en attente de check-in : ta présence est peut-être déjà confirmée.";
