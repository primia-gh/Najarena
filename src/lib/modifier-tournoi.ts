import { messageModeration } from "@/lib/moderation";
import { messageNiveau } from "@/lib/niveau-tournoi";

// Modification d'un tournoi avant la première inscription (19/11/2026,
// audit M7). Toutes les règles sont appliquées par la base
// (modifier_tournoi, docs/schema.sql) ; ici, seulement les messages.

/** Plafond de la base : modifications par organisateur et par 24 h. */
export const MODIFICATIONS_TOURNOI_PAR_JOUR = 10;

const MESSAGES: Record<string, string> = {
  TOURNOI_INTROUVABLE: "Ce tournoi n'existe pas ou n'est pas le tien.",
  TOURNOI_NON_MODIFIABLE: "Ce tournoi ne se modifie plus : son check-in est ouvert, ou il a commencé.",
  INSCRIPTIONS_COMMENCEES:
    "Quelqu'un s'est déjà inscrit : les réglages sont figés. Pour changer la date, annule ce tournoi et crée-en un autre.",
  DOTATION_ENREGISTREE: "Une dotation est enregistrée sur ce tournoi : ses réglages sont figés.",
  NOM_INVALIDE: "Le nom doit faire entre 3 et 60 caractères.",
  CAPACITE_INVALIDE: "Capacité invalide.",
  BEST_OF_INVALIDE: "Format Best-of invalide.",
  OFFRE_ORGANISATEUR_REQUISE: "128 places et les Best-of 3 ou 5 demandent l'offre Organisateur.",
  REGION_INVALIDE: "Choisis une région.",
  DATE_PASSEE: "La date de début doit être dans le futur.",
  CHECKIN_APRES_DEBUT: "Le check-in doit s'ouvrir avant (ou au moment de) le début du tournoi.",
  LIMITE_ATTEINTE: `Tu as modifié des tournois ${MODIFICATIONS_TOURNOI_PAR_JOUR} fois ces dernières 24 h : réessaie plus tard.`,
};

/** Message lisible pour un refus de la base, à partir de son code. */
export function messageRefusModification(erreur: string | undefined | null): string {
  const texte = erreur ?? "";
  const code = Object.keys(MESSAGES).find((c) => texte.includes(c));
  if (code) return MESSAGES[code];
  return messageNiveau(texte) ?? messageModeration(texte) ?? "Impossible de modifier le tournoi pour l'instant.";
}
