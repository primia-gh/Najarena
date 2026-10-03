import { creerClientPublic } from "@/lib/supabase/public";
import { chargerTournoiPublic, URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { optionsWidget, pageWidget, widgetBracket } from "@/lib/widgets";
import { lirePublic, reponseWidget } from "@/lib/reponses-publiques";

// Widget « bracket » d'un tournoi (audit N31), à intégrer en iframe.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const options = optionsWidget(new URL(request.url).searchParams);
  const lecture = await lirePublic(() => chargerTournoiPublic(creerClientPublic(), slug));
  if (!lecture.ok) {
    return reponseWidget(
      pageWidget("Najarena", `<p class="muted">Données indisponibles pour l'instant.</p>`, URL_PUBLIQUE, options),
      503,
    );
  }
  if (!lecture.valeur) {
    return reponseWidget(
      pageWidget("Tournoi introuvable", `<p class="muted">Tournoi introuvable.</p>`, URL_PUBLIQUE, options),
      404,
    );
  }
  return reponseWidget(widgetBracket(lecture.valeur, options));
}
