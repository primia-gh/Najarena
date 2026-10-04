import type { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Adresses de CV et visites de profil (28/09/2026, audit E7, M10, M12).

/** Adresse actuelle d'un CV dont le joueur a changé de pseudo, ou null. */
export async function adresseActuelleProfil(supabase: SupabaseServer, ancienSlug: string): Promise<string | null> {
  const { data } = await supabase
    .from("anciens_slugs")
    .select("profil:profiles(slug)")
    .eq("slug", ancienSlug)
    .maybeSingle();
  return data?.profil?.slug ?? null;
}

/**
 * Enregistre la visite d'un profil pour « Qui a vu ton profil » — sauf si
 * le visiteur a choisi les visites anonymes. Appelée après l'envoi de la
 * page (after), elle ne la ralentit pas ; d'où le client serveur, sans
 * cookies. La règle est aussi appliquée par la base pour une écriture
 * directe (policy de vues_profil).
 */
export async function enregistrerVisite(profilId: string, visiteurId: string): Promise<void> {
  if (profilId === visiteurId) return;
  const admin = creerClientAdmin();
  if (!admin) return;

  const { data: visiteur } = await admin
    .from("profiles")
    .select("visites_anonymes")
    .eq("id", visiteurId)
    .maybeSingle();
  if (!visiteur || visiteur.visites_anonymes) return;

  await admin.from("vues_profil").upsert({
    profile_id: profilId,
    vu_par: visiteurId,
    derniere_vue_le: new Date().toISOString(),
  });
}
