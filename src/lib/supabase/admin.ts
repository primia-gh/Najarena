import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Client privilégié (service_role) — contourne la RLS. Réservé aux
// écritures qui ne doivent JAMAIS être exposées au client, comme
// confirmer une vérification Riot après un contrôle que seul le
// serveur peut faire. Ne jamais importer ce fichier depuis un composant
// client, ni l'utiliser sans avoir d'abord revérifié auth.uid() côté
// serveur (ce client bypass la RLS, il ne remplace pas le contrôle).
export function creerClientAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !cleService) {
    return null;
  }

  return createSupabaseClient<Database>(url, cleService, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
