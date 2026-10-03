import { creerClientPublic } from "@/lib/supabase/public";
import { chargerTop } from "@/lib/donnees-publiques";
import { lirePublic, reponseApi, reponseIndisponible, reponseOptions } from "@/lib/reponses-publiques";

// API publique (audit N31) : classement de la saison en cours, joueurs
// classés seulement. ?limite=1..100 (25 par défaut).
export async function GET(request: Request) {
  const brute = Number(new URL(request.url).searchParams.get("limite") ?? 25);
  const limite = Number.isInteger(brute) ? Math.min(Math.max(brute, 1), 100) : 25;
  const lecture = await lirePublic(() => chargerTop(creerClientPublic(), limite));
  return lecture.ok ? reponseApi({ saison: "en_cours", joueurs: lecture.valeur }) : reponseIndisponible();
}

export function OPTIONS() {
  return reponseOptions();
}
