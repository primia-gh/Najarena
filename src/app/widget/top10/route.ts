import { creerClientPublic } from "@/lib/supabase/public";
import { chargerTop, URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { optionsWidget, pageWidget, widgetTop } from "@/lib/widgets";
import { lirePublic, reponseWidget } from "@/lib/reponses-publiques";

// Widget « top 10 » du classement de la saison (audit N31).
export async function GET(request: Request) {
  const options = optionsWidget(new URL(request.url).searchParams);
  const lecture = await lirePublic(() => chargerTop(creerClientPublic(), 10));
  if (!lecture.ok) {
    return reponseWidget(
      pageWidget("Najarena", `<p class="muted">Données indisponibles pour l'instant.</p>`, URL_PUBLIQUE, options),
      503,
    );
  }
  return reponseWidget(widgetTop(lecture.valeur, `${URL_PUBLIQUE}/lol/classement`, options));
}
