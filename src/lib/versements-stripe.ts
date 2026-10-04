// Versement des cash prizes par Stripe Connect (04/10/2026, audit N32),
// toujours éteint tant que CASH_PRIZES_ACTIFS n'est pas à « 1 » (voir
// lib/dotations.ts). Le gagnant ouvre un compte de versement chez Stripe,
// qui vérifie son identité et ses coordonnées bancaires sur ses propres
// pages ; un administrateur déclenche ensuite le virement depuis le solde
// Najarena, alimenté par le sponsor. Les règles (un compte par joueur, un
// virement par gain, jamais vers un compte non vérifié) sont en base.
// Logique pure, testée dans versements-stripe.test.ts.

/** Pays de résidence acceptés pour un compte de versement. */
export const PAYS_VERSEMENT = [
  { code: "FR", nom: "France" },
  { code: "BE", nom: "Belgique" },
  { code: "CH", nom: "Suisse" },
  { code: "LU", nom: "Luxembourg" },
  { code: "CA", nom: "Canada" },
] as const;

export type CodePaysVersement = (typeof PAYS_VERSEMENT)[number]["code"];

export function codePaysVersement(saisie: string): CodePaysVersement | null {
  return PAYS_VERSEMENT.find((p) => p.code === saisie)?.code ?? null;
}

/** Ce que Stripe dit d'un compte de versement (sous-ensemble de Stripe.Account). */
export interface EtatCompteStripe {
  details_submitted?: boolean | null;
  payouts_enabled?: boolean | null;
  capabilities?: { transfers?: string | null } | null;
  requirements?: { currently_due?: string[] | null; disabled_reason?: string | null } | null;
}

/**
 * Identité et coordonnées bancaires vérifiées par Stripe, rien en attente :
 * le compte peut recevoir un virement.
 */
export function compteStripeVerifie(compte: EtatCompteStripe): boolean {
  return (
    compte.details_submitted === true &&
    compte.payouts_enabled === true &&
    compte.capabilities?.transfers === "active" &&
    !compte.requirements?.disabled_reason &&
    (compte.requirements?.currently_due ?? []).length === 0
  );
}

/** Groupe Stripe d'un tournoi doté : retrouve ses virements. */
export function groupeVirement(tournamentId: string): string {
  return `dotation_${tournamentId}`;
}

/** Clé d'idempotence d'un gain : une relance ne paie jamais deux fois. */
export function cleVirement(tournamentId: string, profileId: string): string {
  return `dotation:${tournamentId}:${profileId}`;
}

export const LIBELLE_STATUT_VERSEMENT: Record<string, string> = {
  a_verser: "À verser",
  verse: "Versé",
  refuse: "Refusé",
};
