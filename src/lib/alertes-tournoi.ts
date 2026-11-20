// Alertes « tournoi pour toi » (20/11/2026). Le joueur choisit ses créneaux
// (mêmes créneaux que le duo : semaine / week-end × journée, soir, nuit,
// heure de Paris) et ses formats ; la tâche des tournois automatiques le
// prévient (notification et message privé Discord, jamais d'e-mail) quand un
// tournoi s'ouvre pour lui. Toutes les règles — serveur du compte Riot,
// niveau, place restante, 3 alertes au plus par 24 h, jamais deux fois le
// même tournoi — sont appliquées par la base (reserver_alertes_tournoi,
// docs/schema.sql). Ici : libellés, lecture du formulaire, texte du message.

import { CRENEAUX_DUO, LABEL_CRENEAU, estCreneau, type CreneauDuo } from "@/lib/duo";
import { formaterDate } from "@/lib/tournois";

export const ALERTES_PAR_JOUR = 3;
export const PREAVIS_MIN_HEURES = 1;
export const PREAVIS_MAX_JOURS = 7;

export const FORMATS_ALERTE = ["1v1", "5v5"] as const;
export type FormatAlerte = (typeof FORMATS_ALERTE)[number];

export const LABEL_FORMAT_ALERTE: Record<FormatAlerte, string> = {
  "1v1": "Tournois 1v1",
  "5v5": "Tournois 5v5",
};

export function estFormatAlerte(valeur: unknown): valeur is FormatAlerte {
  return typeof valeur === "string" && (FORMATS_ALERTE as readonly string[]).includes(valeur);
}

/** Créneaux et formats cochés, sans doublon et dans l'ordre d'affichage. */
export function lireReglageAlertes(formData: FormData): { creneaux: CreneauDuo[]; formats: FormatAlerte[] } {
  const creneaux = new Set(formData.getAll("creneaux").filter(estCreneau));
  const formats = new Set(formData.getAll("formats").filter(estFormatAlerte));
  return {
    creneaux: CRENEAUX_DUO.filter((c) => creneaux.has(c)),
    formats: FORMATS_ALERTE.filter((f) => formats.has(f)),
  };
}

const MESSAGES: Record<string, string> = {
  COMPTE_RIOT_REQUIS: "Lie et vérifie ton Riot ID d'abord : les alertes suivent le serveur de ton compte.",
  COMPTE_SUSPENDU: "Ton compte est suspendu : les alertes sont indisponibles.",
  CRENEAUX_INVALIDES: "Coche au moins un créneau.",
  FORMATS_INVALIDES: "Coche au moins un format.",
};

export function messageRefusAlertes(erreur: string, defaut: string): string {
  const code = Object.keys(MESSAGES).find((c) => erreur.includes(c));
  return code ? MESSAGES[code] : defaut;
}

/** Résumé du réglage : « Semaine · soir, Week-end · soir — 1v1 ». */
export function resumeAlertes(creneaux: readonly string[], formats: readonly string[]): string {
  const c = CRENEAUX_DUO.filter((x) => creneaux.includes(x)).map((x) => LABEL_CRENEAU[x]);
  const f = FORMATS_ALERTE.filter((x) => formats.includes(x));
  return `${c.join(", ")} — ${f.join(" et ")}`;
}

/** Titre et texte du message envoyé au joueur. */
export function messageAlerte(t: { nom: string; debute_le: string; format: string; region: string }): {
  titre: string;
  texte: string;
} {
  return {
    titre: `Un tournoi pour toi — ${t.nom}`,
    texte: `Tournoi ${t.format} sur ${t.region}, le ${formaterDate(t.debute_le)}, ouvert à toi, avec encore de la place. Tu reçois ce message parce que tu as demandé les alertes « tournoi pour toi » (à couper depuis ton compte).`,
  };
}
