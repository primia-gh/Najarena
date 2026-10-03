// Espaces communauté (03/10/2026, audit N30) : la page d'un serveur
// Discord ou d'une association — ses tournois, le classement interne de ses
// membres et ses membres. La base applique les règles (creer_communaute,
// rejoindre_communaute… docs/schema.sql) ; ce fichier sert à l'affichage.

export const COULEUR_COMMUNAUTE_DEFAUT = "#2BD47D";
export const COMMUNAUTES_MAX_PAR_ORGANISATEUR = 3;
export const DUREE_CODE_LIAISON_MINUTES = 30;

export function couleurValide(couleur: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(couleur);
}

/** Lien d'invitation Discord accepté par la base (discord.gg ou discord.com/invite). */
export function lienDiscordValide(lien: string): boolean {
  return /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,40}$/.test(lien);
}

export type RoleCommunaute = "proprietaire" | "admin" | "membre";

export const LIBELLE_ROLE_COMMUNAUTE: Record<RoleCommunaute, string> = {
  proprietaire: "Fondateur",
  admin: "Administrateur",
  membre: "Membre",
};

export function roleCommunaute(role: string | null | undefined): RoleCommunaute | null {
  return role === "proprietaire" || role === "admin" || role === "membre" ? role : null;
}

export interface MembreClasse {
  profileId: string;
  pseudo: string;
  slug: string;
  rating: number;
}

/**
 * Classement interne : les membres classés (RD ≤ 150) par rating officiel
 * décroissant — jamais un rating propre à la communauté. Les autres sont
 * comptés à part, sans chiffre (CLAUDE.md §4 : pas de rating affiché avant
 * l'entrée au classement).
 */
export function classementInterne(
  membres: { profileId: string; pseudo: string; slug: string }[],
  ratings: Map<string, { rating: number; estClasse: boolean }>,
): { classes: MembreClasse[]; nonClasses: number } {
  const classes: MembreClasse[] = [];
  let nonClasses = 0;
  for (const m of membres) {
    const r = ratings.get(m.profileId);
    if (r?.estClasse) classes.push({ ...m, rating: r.rating });
    else nonClasses++;
  }
  classes.sort((a, b) => b.rating - a.rating || a.pseudo.localeCompare(b.pseudo));
  return { classes, nonClasses };
}

const MESSAGES_REFUS: Record<string, string> = {
  NON_CONNECTE: "Connecte-toi d'abord.",
  COMPTE_SUSPENDU: "Ton compte est suspendu.",
  OFFRE_ORGANISATEUR_REQUISE: "Créer une communauté demande l'offre Organisateur.",
  TROP_DE_COMMUNAUTES: `Tu as déjà ${COMMUNAUTES_MAX_PAR_ORGANISATEUR} communautés : c'est le maximum.`,
  NOM_INTERDIT: "Ce nom n'est pas accepté (propos interdits ou usurpation).",
  TEXTE_INTERDIT: "Cette description contient des propos interdits.",
  COMMUNAUTE_INTROUVABLE: "Cette communauté n'existe pas.",
  COMMUNAUTE_PROPRIETAIRE: "Le fondateur ne peut pas quitter sa communauté.",
  GESTION_RESERVEE: "Action réservée au fondateur ou aux administrateurs de la communauté.",
  COMMUNAUTE_INTERDITE: "Seuls le fondateur et les administrateurs publient des tournois dans cette communauté.",
  communautes_slug_key: "Cette adresse est déjà prise : change un peu le nom.",
  communautes_couleur_check: "Couleur invalide.",
  communautes_lien_discord_check: "Le lien doit être une invitation Discord (https://discord.gg/…).",
  communautes_nom_check: "Le nom doit faire entre 3 et 40 caractères.",
  communautes_description_check: "La description fait 500 caractères au plus.",
};

export function messageRefusCommunaute(erreur: string, parDefaut: string): string {
  const code = Object.keys(MESSAGES_REFUS).find((c) => erreur.includes(c));
  return code ? MESSAGES_REFUS[code] : parDefaut;
}
