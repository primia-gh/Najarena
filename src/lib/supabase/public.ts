import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Client anonyme sans cookies, pour les lectures publiques qui doivent
// pouvoir être mises en cache (images de partage) : il voit exactement ce
// que voit un visiteur déconnecté, RLS comprise.
export function creerClientPublic() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
