import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { progressionPalier, type Palier } from "@/lib/classement";
import { LABEL_ROLE, type Role } from "@/lib/roles";
import { libelleEquipe, parcoursDansTournoi } from "@/lib/cinq-contre-cinq";
import { lignesFiche } from "@/lib/fiche-organisateur";

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

export interface SaisonPassee {
  numero: number;
  nom: string;
  finLe: string;
  rating: number;
  /** Palier final, seulement si le joueur était classé (RD ≤ 150). */
  palier: Palier | null;
  rang: number | null;
  classes: number;
}

/** Tournoi 5v5 terminé où le joueur était aligné (audit N21). */
export interface TournoiEnEquipe {
  nom: string;
  slug: string;
  debuteLe: string;
  equipe: string;
  resultat: string;
}

export interface EquipeJoueur {
  nom: string;
  slug: string;
  depuis: string | null;
  estCapitaine: boolean;
  role: string | null;
}

// cache : partagé par generateMetadata et la page, le temps d'une requête.
export const chargerComplementsProfil = cache(async (profilId: string) => {
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
    supabase
      .from("recherches_coequipiers")
      .select("message, cree_le, objectif:echeances(nom, debut_le)")
      .eq("profile_id", profilId)
      .maybeSingle(),
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

  // Saisons terminées (audit N14) : palier et rang finals, inscrits au
  // parcours du CV. Une ligne de rating par saison ; les rangs se comptent
  // parmi les classés de la même saison.
  const { data: lignesSaisons } = await supabase
    .from("ratings")
    .select("rating, est_classe, season_id, saison:seasons(numero, nom, debut_le, fin_le, est_courante)")
    .eq("profile_id", profilId)
    .eq("game_id", 1);
  const maintenant = Date.now();
  const saisonsPassees: SaisonPassee[] = await Promise.all(
    (lignesSaisons ?? [])
      .filter((l) => l.saison && !l.saison.est_courante && new Date(l.saison.debut_le).getTime() <= maintenant)
      .map(async (l) => {
        let rang: number | null = null;
        let classes = 0;
        if (l.est_classe) {
          const [{ count: devant }, { count: total }] = await Promise.all([
            supabase
              .from("ratings")
              .select("*", { count: "exact", head: true })
              .eq("game_id", 1)
              .eq("season_id", l.season_id)
              .eq("est_classe", true)
              .gt("rating", l.rating),
            supabase
              .from("ratings")
              .select("*", { count: "exact", head: true })
              .eq("game_id", 1)
              .eq("season_id", l.season_id)
              .eq("est_classe", true),
          ]);
          rang = (devant ?? 0) + 1;
          classes = total ?? 0;
        }
        return {
          numero: l.saison!.numero,
          nom: l.saison!.nom ?? `Saison ${l.saison!.numero}`,
          finLe: l.saison!.fin_le,
          rating: l.rating,
          palier: l.est_classe ? progressionPalier(l.rating, paliers).palier : null,
          rang,
          classes,
        };
      }),
  );
  saisonsPassees.sort((a, b) => b.numero - a.numero);

  // Fiche publique d'organisateur (audit N13), s'il en a publié.
  const { data: fiche } = await supabase.rpc("fiche_organisateur", { p_profile_id: profilId }).maybeSingle();

  // Tournois 5v5 terminés où il était aligné (audit N21) : où son équipe
  // s'est arrêtée, d'après le bracket (le capitaine y représente l'équipe).
  const { data: alignes } = await supabase
    .from("alignements")
    .select(
      "registration:registrations!inner(profile_id, equipe_nom, equipe_tag), tournament:tournaments!inner(id, nom, slug, statut, debute_le, capacite, nature)",
    )
    .eq("profile_id", profilId)
    .eq("tournament.statut", "termine")
    // Tournois seulement : les scrims (audit N22) restent sur la page d'équipe.
    .eq("tournament.nature", "tournoi")
    .order("aligne_le", { ascending: false })
    .limit(10);
  const capitaines = [...new Set((alignes ?? []).map((a) => a.registration.profile_id))];
  const { data: matchsEquipes } =
    capitaines.length > 0
      ? await supabase
          .from("match_participants")
          .select(
            "profile_id, est_gagnant, match:matches!inner(tour, tournament_id, match_verdicts(niveau, est_definitif))",
          )
          .in("profile_id", capitaines)
          .in(
            "match.tournament_id",
            (alignes ?? []).map((a) => a.tournament.id),
          )
      : { data: [] };
  const tournoisEnEquipe: TournoiEnEquipe[] = (alignes ?? []).map((a) => ({
    nom: a.tournament.nom,
    slug: a.tournament.slug,
    debuteLe: a.tournament.debute_le,
    equipe: libelleEquipe(a.registration.equipe_tag, a.registration.equipe_nom),
    resultat: parcoursDansTournoi({
      statut: a.tournament.statut,
      capacite: a.tournament.capacite,
      matchs: (matchsEquipes ?? [])
        .filter((m) => m.profile_id === a.registration.profile_id && m.match.tournament_id === a.tournament.id)
        .map((m) => ({
          tour: m.match.tour,
          estGagnant: m.est_gagnant,
          verifie: m.match.match_verdicts.some((v) => v.est_definitif && v.niveau !== "manuel"),
        })),
    }).libelle,
  }));

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
    saisonsPassees,
    tournoisEnEquipe,
    ficheOrganisateur: fiche && fiche.tournois_publies > 0 ? lignesFiche(fiche) : null,
    // Lu ici, pas pendant le rendu : sert à ne plus afficher un objectif passé.
    maintenantIso: new Date().toISOString(),
  };
});
