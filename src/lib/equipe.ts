// Constantes partagées équipes/5v5 — dans un fichier séparé de
// equipe-actions.ts : un fichier "use server" ne peut exporter que des
// fonctions serveur (Server Actions), pas une constante simple.
export const TAILLE_MAX_EQUIPE = 5;

/**
 * Nom d'équipe (18/11/2026), même règle que la base (controler_nom_equipe) :
 * 3 à 40 caractères, lettres latines (accents compris), chiffres, espaces
 * et ponctuation simple — pas de lettre sosie d'un autre alphabet, qui
 * contournerait l'unicité des noms — et jamais « Agents libres… », réservé
 * aux équipes formées par la base.
 */
const CARACTERES_NOM_EQUIPE = /^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9 '’.&!?#+:()_-]+$/;

export function estNomEquipeValide(nom: string): boolean {
  const n = nom.trim();
  if (n.length < 3 || n.length > 40 || !CARACTERES_NOM_EQUIPE.test(n)) return false;
  const cle = n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "o")
    .replace(/æ/g, "a")
    .replace(/ð/g, "d")
    .replace(/ø/g, "o")
    .replace(/þ/g, "t")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
  return cle.length > 0 && !cle.startsWith("agentslibres");
}

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
