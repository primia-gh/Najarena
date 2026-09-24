import { createClient } from "@/lib/supabase/server";
import { progressionPalier, type Palier } from "@/lib/classement";
import { LABEL_ROLE, type Role } from "@/lib/roles";

// Données d'affichage ajoutées par la refonte « Venin » du profil
// (design-system/najarena/pages/profil.md) : classement national, palier,
// courbe de la saison, annonce « cherche une équipe », équipes, rôle.
// Uniquement des LECTURES de tables publiques, rangées ici pour laisser
// intact le chargement d'origine de joueur/[pseudo]/page.tsx (chargerJoueur :
// vues de profil, offres, suivi, revue de match).
// game_id=1 est LoL — seule ligne de `games` en V1.

export interface PointCourbe {
  rating: number;
  le: string;
}

export interface EquipeJoueur {
  nom: string;
  slug: string;
  depuis: string | null;
  estCapitaine: boolean;
  role: string | null;
}

export async function chargerComplementsProfil(profilId: string) {
  const supabase = await createClient();

  const [
    { data: saison },
    { data: paliersData },
    { data: annonce },
    { data: compte },
    { data: membresData },
    { data: profil },
  ] = await Promise.all([
    supabase.from("seasons").select("id, nom, numero").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
    supabase.from("recherches_coequipiers").select("message, cree_le").eq("profile_id", profilId).maybeSingle(),
    supabase
      .from("game_accounts")
      .select("role_prefere")
      .eq("profile_id", profilId)
      .eq("est_principal", true)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("role, accepte_le, equipe:teams(nom, slug, capitaine_id, game_id)")
      .eq("profile_id", profilId)
      .not("accepte_le", "is", null),
    supabase.from("profiles").select("avatar_url").eq("id", profilId).maybeSingle(),
  ]);

  const paliers: Palier[] = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  // Rating de la saison courante : base du rang national et de la courbe.
  let ratingSaison: { rating: number; est_classe: boolean | null } | null = null;
  let rangNational: number | null = null;
  let totalClasses = 0;
  let courbe: PointCourbe[] = [];

  if (saison) {
    const [{ data: r }, { count: total }, { data: evenements }] = await Promise.all([
      supabase
        .from("ratings")
        .select("rating, est_classe")
        .eq("profile_id", profilId)
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .maybeSingle(),
      supabase
        .from("ratings")
        .select("*", { count: "exact", head: true })
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .eq("est_classe", true),
      supabase
        .from("rating_events")
        .select("rating_avant, rating_apres, cree_le")
        .eq("profile_id", profilId)
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .order("cree_le", { ascending: true })
        .limit(300),
    ]);
    ratingSaison = r ?? null;
    totalClasses = total ?? 0;

    if (ratingSaison?.est_classe) {
      const { count: devant } = await supabase
        .from("ratings")
        .select("*", { count: "exact", head: true })
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .eq("est_classe", true)
        .gt("rating", ratingSaison.rating);
      rangNational = (devant ?? 0) + 1;
    }

    // Courbe : point de départ (rating avant le premier événement), puis le
    // rating après chaque variation de la saison.
    const ev = evenements ?? [];
    if (ev.length > 0) {
      courbe = [
        { rating: ev[0].rating_avant, le: ev[0].cree_le },
        ...ev.map((e) => ({ rating: e.rating_apres, le: e.cree_le })),
      ];
    }
  }

  // Palier et palier suivant, à partir du rating de la saison.
  let palier: Palier | null = null;
  let palierSuivant: Palier | null = null;
  if (ratingSaison) {
    palier = progressionPalier(ratingSaison.rating, paliers).palier;
    const tries = [...paliers].sort((a, b) => a.ratingMin - b.ratingMin);
    palierSuivant = tries.find((p) => p.ratingMin > ratingSaison.rating) ?? null;
  }

  const equipes: EquipeJoueur[] = (membresData ?? [])
    .filter((m) => m.equipe && m.equipe.game_id === 1)
    .map((m) => ({
      nom: m.equipe!.nom,
      slug: m.equipe!.slug,
      depuis: m.accepte_le,
      estCapitaine: m.equipe!.capitaine_id === profilId,
      role: m.role,
    }))
    .sort((a, b) => new Date(b.depuis ?? 0).getTime() - new Date(a.depuis ?? 0).getTime());

  const role = (compte?.role_prefere ?? null) as Role | null;

  return {
    saison,
    rangNational,
    totalClasses,
    palier,
    palierSuivant,
    courbe,
    annonce,
    equipes,
    roleLibelle: role ? LABEL_ROLE[role] : null,
    avatarUrl: profil?.avatar_url ?? null,
  };
}
