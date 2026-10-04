import { creerClientPublic } from "@/lib/supabase/public";
import { chargerJoueurPublic, URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { optionsWidget, pageWidget, widgetJoueur } from "@/lib/widgets";
import { lirePublic, reponseWidget } from "@/lib/reponses-publiques";

// Widget « carte CV » d'un joueur (audit N31).
export async function GET(request: Request, { params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  const options = optionsWidget(new URL(request.url).searchParams);
  const lecture = await lirePublic(() => chargerJoueurPublic(creerClientPublic(), pseudo));
  if (!lecture.ok) {
    return reponseWidget(
      pageWidget("Najarena", `<p class="muted">Données indisponibles pour l'instant.</p>`, URL_PUBLIQUE, options),
      503,
    );
  }
  if (!lecture.valeur) {
    return reponseWidget(
      pageWidget("Joueur introuvable", `<p class="muted">Joueur introuvable.</p>`, URL_PUBLIQUE, options),
      404,
    );
  }
  return reponseWidget(widgetJoueur(lecture.valeur, options));
}
