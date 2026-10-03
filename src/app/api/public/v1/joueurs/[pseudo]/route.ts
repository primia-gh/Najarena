import { creerClientPublic } from "@/lib/supabase/public";
import { chargerJoueurPublic } from "@/lib/donnees-publiques";
import { lirePublic, reponseApi, reponseIndisponible, reponseOptions } from "@/lib/reponses-publiques";

// API publique (audit N31) : résumé du CV d'un joueur, par l'adresse de son
// profil (/joueur/<adresse>). Rating et palier seulement une fois classé.
export async function GET(_request: Request, { params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  const lecture = await lirePublic(() => chargerJoueurPublic(creerClientPublic(), pseudo));
  if (!lecture.ok) return reponseIndisponible();
  return lecture.valeur ? reponseApi(lecture.valeur) : reponseApi({ erreur: "Joueur introuvable." }, 404);
}

export function OPTIONS() {
  return reponseOptions();
}
