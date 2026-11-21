import { creerClientPublic } from "@/lib/supabase/public";
import { chargerMatchOverlay, URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { widgetMatch } from "@/lib/overlay-match";
import { optionsWidget, pageWidget, PIED_NEUTRE } from "@/lib/widgets";
import { lirePublic, redirectionWidget, reponseWidget } from "@/lib/reponses-publiques";

// Overlay d'un match précis (21/11/2026), pour un stream ou une page
// d'équipe : l'identifiant est la fin de l'adresse de sa fiche de preuve.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const redirection = redirectionWidget(request);
  if (redirection) return redirection;
  const { id } = await params;
  const options = optionsWidget(new URL(request.url).searchParams);
  const lecture = await lirePublic(() => chargerMatchOverlay(creerClientPublic(), id));
  if (!lecture.ok) {
    return reponseWidget(
      pageWidget(
        "Najarena",
        `<p class="muted">Données indisponibles pour l'instant.</p>`,
        URL_PUBLIQUE,
        options,
        PIED_NEUTRE,
      ),
      503,
    );
  }
  if (!lecture.valeur) {
    return reponseWidget(
      pageWidget("Match introuvable", `<p class="muted">Match introuvable.</p>`, URL_PUBLIQUE, options, PIED_NEUTRE),
      404,
    );
  }
  return reponseWidget(widgetMatch(lecture.valeur, options));
}
