import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Widgets et API publique (audit N31) : lectures anonymes, sans session
    // à rafraîchir — exclus pour rester légers et mis en cache.
    "/((?!_next/static|_next/image|favicon.ico|widget/|api/public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
