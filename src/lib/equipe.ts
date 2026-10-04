// Constantes partagées équipes/5v5 — dans un fichier séparé de
// equipe-actions.ts : un fichier "use server" ne peut exporter que des
// fonctions serveur (Server Actions), pas une constante simple.
export const TAILLE_MAX_EQUIPE = 5;

function echapperRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Logo d'équipe accepté (28/09/2026, audit M6) : uniquement une image
 * déposée dans l'espace de stockage « logos », à l'emplacement de l'équipe
 * (equipe/{id}.png|jpg|jpeg|webp), éventuellement suivie de ?v=… (voir
 * UploadLogo). La base applique la même règle (teams_logo_url_stockage).
 */
export function estLogoEquipeValide(
  url: string,
  teamId: string,
  baseSupabase: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): boolean {
  if (!baseSupabase) return false;
  const prefixe = `${baseSupabase.replace(/\/$/, "")}/storage/v1/object/public/logos/equipe/${teamId}.`;
  return new RegExp(`^${echapperRegex(prefixe)}(png|jpg|jpeg|webp)(\\?v=[0-9]+)?$`).test(url);
}
