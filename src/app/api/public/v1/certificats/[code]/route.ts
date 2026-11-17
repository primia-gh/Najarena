import { creerClientPublic } from "@/lib/supabase/public";
import { clesPubliees, etatSignature } from "@/lib/signature-certificats";
import { lirePublic, reponseApi, reponseIndisponible, reponseOptions } from "@/lib/reponses-publiques";

// API publique : un certificat de niveau signé (idée en réserve n°2), pour
// le vérifier hors de Najarena (scripts/verifier-certificat.mjs). `contenu`
// est le texte exact signé ; `signature` et `cle_publique` en base64
// (Ed25519). Seul celui qui a reçu le code peut le lire, comme la page.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[0-9a-f]{12}$/.test(code)) return reponseApi({ erreur: "Certificat introuvable." }, 404);

  const lecture = await lirePublic(async () => {
    const supabase = creerClientPublic();
    const [{ data: certificat, error }, { data: contenu }] = await Promise.all([
      supabase.rpc("lire_certificat", { p_code: code }).maybeSingle(),
      supabase.rpc("contenu_certificat", { p_code: code }),
    ]);
    if (error) throw error;
    return certificat ? { certificat, contenu: contenu ?? null } : null;
  });
  if (!lecture.ok) return reponseIndisponible();
  if (!lecture.valeur) return reponseApi({ erreur: "Certificat introuvable." }, 404);

  const { certificat, contenu } = lecture.valeur;
  return reponseApi({
    code: certificat.code,
    joueur: certificat.compte_supprime ? null : { pseudo: certificat.pseudo, slug: certificat.slug },
    contenu,
    algorithme: "Ed25519",
    signature: certificat.signature,
    cle_publique: certificat.cle_publique,
    etat_signature: etatSignature(contenu, certificat.signature, certificat.cle_publique, clesPubliees()),
  });
}

export function OPTIONS() {
  return reponseOptions();
}
