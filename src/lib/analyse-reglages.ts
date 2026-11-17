// Messages des refus de regler_analyse (docs/schema.sql, section 42).

const MESSAGES: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi d'abord.",
  COMPTE_RIOT_NON_VERIFIE: "Lie et vérifie d'abord ton compte Riot principal : c'est lui dont les parties classées sont lues.",
  OFFRE_ELITE_REQUISE: "Le bilan de la semaine sur Discord fait partie de l'offre Elite.",
  DISCORD_NON_LIE: "Connecte-toi une fois avec Discord pour recevoir ton bilan de la semaine en message privé.",
};

export function messageRefusAnalyse(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES).find((c) => erreur.includes(c));
  return code ? MESSAGES[code] : parDefaut;
}
