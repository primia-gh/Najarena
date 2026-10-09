import { creerClientPublic } from "@/lib/supabase/public";
import { chargerDonneesRecalcul } from "@/lib/recalcul-donnees";
import { lirePublic, reponseApi, reponseIndisponible, reponseOptions } from "@/lib/reponses-publiques";

// API publique (09/10/2026, idée en réserve n°4) : tout ce qu'il faut pour
// refaire soi-même le calcul Glicko-2 d'un joueur — ses lignes du registre,
// ses matchs avec leur verdict, et l'état de départ de ses adversaires dans
// chaque tournoi. Le calcul lui-même : lib/recalcul.ts, page
// /joueur/<adresse>/recalcul.
export async function GET(_request: Request, { params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  const lecture = await lirePublic(() => chargerDonneesRecalcul(creerClientPublic(), pseudo));
  if (!lecture.ok) return reponseIndisponible();
  return lecture.valeur ? reponseApi(lecture.valeur) : reponseApi({ erreur: "Joueur introuvable." }, 404);
}

export function OPTIONS() {
  return reponseOptions();
}
