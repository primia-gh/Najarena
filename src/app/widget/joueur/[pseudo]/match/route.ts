import { creerClientPublic } from "@/lib/supabase/public";
import { chargerOverlayJoueur, URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { widgetMatch, widgetSansMatch } from "@/lib/overlay-match";
import { optionsWidget, pageWidget } from "@/lib/widgets";
import { lirePublic, redirectionWidget, reponseWidget } from "@/lib/reponses-publiques";

// Overlay « mon match » d'un joueur (21/11/2026) : une seule adresse à
// placer dans OBS, qui suit son match du moment, d'un tournoi à l'autre
// (duels, arène et équipe 5v5 compris). Choix du match : choisirMatchJoueur.
export async function GET(request: Request, { params }: { params: Promise<{ pseudo: string }> }) {
  const redirection = redirectionWidget(request);
  if (redirection) return redirection;
  const { pseudo } = await params;
  const options = optionsWidget(new URL(request.url).searchParams);
  const lecture = await lirePublic(() => chargerOverlayJoueur(creerClientPublic(), pseudo));
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
  const { pseudo: nom, url, match } = lecture.valeur;
  return reponseWidget(match ? widgetMatch(match, options) : widgetSansMatch(nom, url, options));
}
