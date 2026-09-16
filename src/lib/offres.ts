import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Offre payante d'un compte (Vérifié / Elite / Organisateur) — distinct du
// "palier" de classement (Bronze/Argent/Or..., voir src/lib/paliers.ts) :
// deux concepts sans rapport, jamais le même mot dans le code.
export type Offre = "gratuit" | "verifie" | "elite" | "organisateur";

export const LABEL_OFFRE: Record<Exclude<Offre, "gratuit">, string> = {
  verifie: "Compte Vérifié",
  elite: "Elite",
  organisateur: "Organisateur",
};

export const COULEUR_OFFRE: Record<Exclude<Offre, "gratuit">, string> = {
  verifie: "var(--color-laiton)",
  elite: "var(--color-sceau)",
  organisateur: "#4fb8ae",
};

export const ORDRE_OFFRE: Record<Offre, number> = {
  gratuit: 0,
  verifie: 1,
  elite: 2,
  organisateur: 3,
};

export interface InfoOffre {
  offre: Offre;
  bio: string | null;
  lien_externe: string | null;
}

// L'absence de ligne dans `comptes_offres` vaut "gratuit" — jamais stocké
// explicitement. Un seul aller-retour pour une liste de profils, sur le
// modèle de `ratingsParJoueur` dans src/app/lol/coequipiers/page.tsx.
export async function chargerOffres(
  supabase: SupabaseServer,
  profileIds: string[],
): Promise<Map<string, InfoOffre>> {
  const carte = new Map<string, InfoOffre>();
  if (profileIds.length === 0) return carte;

  const { data } = await supabase
    .from("comptes_offres")
    .select("profile_id, offre, bio, lien_externe")
    .in("profile_id", profileIds);

  for (const ligne of data ?? []) {
    carte.set(ligne.profile_id, {
      offre: ligne.offre as Offre,
      bio: ligne.bio,
      lien_externe: ligne.lien_externe,
    });
  }
  return carte;
}

export async function chargerOffre(
  supabase: SupabaseServer,
  profileId: string,
): Promise<InfoOffre> {
  const carte = await chargerOffres(supabase, [profileId]);
  return carte.get(profileId) ?? { offre: "gratuit", bio: null, lien_externe: null };
}
