import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { destinationInterne } from "@/lib/redirection";
import { COOKIE_CONSENTEMENT } from "@/lib/cgu";
import { RETOURS_EXTERNES } from "@/lib/messages-adresse";
import { estPseudoAutomatique } from "@/lib/pseudo";

// Point de retour pour tout provider OAuth (Discord aujourd'hui, RSO plus
// tard — CLAUDE.md §2 : la couche d'identité doit être interchangeable).
// Échange le code contre une session via le même client cookie-aware que
// le reste du site, pas un client à part.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Destination interne uniquement (src/lib/redirection.ts).
  const next = destinationInterne(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Consentement coché avant de partir chez Discord (seConnecterAvecDiscord) :
      // enregistré une seule fois, jamais réécrit (enregistrer_consentement).
      const version = (await cookies()).get(COOKIE_CONSENTEMENT)?.value;
      if (version) {
        await supabase.rpc("enregistrer_consentement", { p_version: version });
      }
      // Première connexion par Discord (audit E7) : le compte porte un pseudo
      // automatique « Joueur-… », qui s'afficherait sur le CV et les brackets.
      // Le joueur choisit d'abord le sien.
      const { data: userData } = await supabase.auth.getUser();
      const { data: profil } = userData.user
        ? await supabase.from("profiles").select("pseudo").eq("id", userData.user.id).maybeSingle()
        : { data: null };
      const destination = profil && estPseudoAutomatique(profil.pseudo) ? "/moi/profil?premiere=1#pseudo" : next;
      const reponse = NextResponse.redirect(`${origin}${destination}`);
      reponse.cookies.delete(COOKIE_CONSENTEMENT);
      return reponse;
    }
  }

  return NextResponse.redirect(
    `${origin}/connexion?erreur=${encodeURIComponent(RETOURS_EXTERNES.connexionImpossible)}`,
  );
}
