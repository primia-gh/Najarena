import { creerClientPublic } from "@/lib/supabase/public";
import { chargerTournoiPublic } from "@/lib/donnees-publiques";
import { lirePublic, reponseApi, reponseIndisponible, reponseOptions } from "@/lib/reponses-publiques";

// API publique (audit N31) : un tournoi et son bracket, avec le niveau de
// chaque verdict (verifie = lu chez Riot ; faux pour une décision manuelle).
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lecture = await lirePublic(() => chargerTournoiPublic(creerClientPublic(), slug));
  if (!lecture.ok) return reponseIndisponible();
  return lecture.valeur ? reponseApi(lecture.valeur) : reponseApi({ erreur: "Tournoi introuvable." }, 404);
}

export function OPTIONS() {
  return reponseOptions();
}
