import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Point de retour pour tout provider OAuth (Discord aujourd'hui, RSO plus
// tard — CLAUDE.md §2 : la couche d'identité doit être interchangeable).
// Échange le code contre une session via le même client cookie-aware que
// le reste du site, pas un client à part.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/moi";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/connexion?erreur=${encodeURIComponent("Connexion impossible, réessaie.")}`,
  );
}
