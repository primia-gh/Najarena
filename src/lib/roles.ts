// Rôles League of Legends — renseignés volontairement par le joueur
// (réglages /moi), utilisés par la recherche recruteur (/lol/recherche).
export type Role = "top" | "jungle" | "mid" | "adc" | "support";

export const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

export const LABEL_ROLE: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "ADC",
  support: "Support",
};
