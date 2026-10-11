import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { sansMessagesForges } from "@/lib/messages-adresse";

export async function proxy(request: NextRequest) {
  // Un message dans l'adresse n'est affiché que s'il vient du site lui-même
  // (src/lib/messages-adresse.ts) : un lien fabriqué ailleurs est nettoyé.
  const propre = sansMessagesForges(new URL(request.url), request.headers.get("sec-fetch-site"));
  if (propre) return NextResponse.redirect(propre);
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Widgets et API publique (audit N31) : lectures anonymes, sans session
    // à rafraîchir — exclus pour rester légers et mis en cache.
    "/((?!_next/static|_next/image|favicon.ico|widget/|api/public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
