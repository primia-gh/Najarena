import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { arrondir, calibrationPct, trouverPalier } from "@/lib/classement";
import { estVisiblePubliquement } from "@/lib/tournois";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";

// Données publiques en lecture seule (03/10/2026, audit N31) : ce que
// montrent l'API publique (/api/public/v1) et les widgets (/widget), lu avec
// le client anonyme — exactement ce que voit un visiteur déconnecté. Mêmes
// règles que le site : pas de rating affiché avant l'entrée au classement,
// un verdict manuel n'est jamais présenté comme vérifié.

export const URL_PUBLIQUE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Client = SupabaseClient<Database>;

/** Base injoignable : l'appelant répond « indisponible », jamais une liste vide trompeuse. */
export class DonneesIndisponibles extends Error {}

function verifier<T extends { error: unknown }>(reponse: T): T {
  if (reponse.error) throw new DonneesIndisponibles("Base injoignable");
  return reponse;
}

async function chargerPaliers(supabase: Client) {
  const { data } = await supabase.from("tiers").select("nom, rating_min").eq("game_id", 1);
  return (data ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
}

export interface LigneTop {
  rang: number;
  pseudo: string;
  slug: string;
  rating: number;
  palier: string | null;
  matchsJoues: number;
}

/** Joueurs classés de la saison en cours, du meilleur au moins bon. */
export async function chargerTop(supabase: Client, limite: number): Promise<LigneTop[]> {
  const { data: saison } = verifier(
    await supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
  );
  if (!saison) return [];
  const [{ data }, paliers] = await Promise.all([
    supabase
      .from("ratings")
      .select("rating, matchs_joues, profile:profiles(pseudo, slug, supprime_le)")
      .eq("game_id", 1)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .order("rating", { ascending: false })
      .limit(Math.min(Math.max(limite, 1), 100) + 10),
    chargerPaliers(supabase),
  ]);
  return (data ?? [])
    .flatMap((r) => (r.profile && !r.profile.supprime_le ? [{ ...r, profile: r.profile }] : []))
    .slice(0, Math.min(Math.max(limite, 1), 100))
    .map((r, i) => ({
      rang: i + 1,
      pseudo: r.profile.pseudo,
      slug: r.profile.slug,
      rating: arrondir(Number(r.rating)),
      palier: trouverPalier(Number(r.rating), paliers)?.nom ?? null,
      matchsJoues: r.matchs_joues,
    }));
}

export interface JoueurPublic {
  pseudo: string;
  slug: string;
  pays: string | null;
  /** Entré au classement (RD ≤ 150) : seul cas où rating et palier sont donnés. */
  classe: boolean;
  rating: number | null;
  palier: string | null;
  confiancePct: number;
  matchsJoues: number;
  /** Matchs dont le résultat a été lu chez Riot (niveaux 2 et 3). */
  matchsVerifies: number;
  url: string;
}

export async function chargerJoueurPublic(supabase: Client, slug: string): Promise<JoueurPublic | null> {
  const { data: profil } = verifier(
    await supabase.from("profiles").select("id, pseudo, slug, pays, supprime_le").eq("slug", slug).maybeSingle(),
  );
  if (!profil || profil.supprime_le) return null;

  const [{ data: rating }, { data: participations }, paliers] = await Promise.all([
    supabase
      .from("ratings")
      .select("rating, rd, matchs_joues, est_classe, season:seasons!inner(est_courante)")
      .eq("profile_id", profil.id)
      .eq("game_id", 1)
      .eq("season.est_courante", true)
      .maybeSingle(),
    supabase
      .from("match_participants")
      .select("match:matches(match_verdicts(niveau, est_definitif))")
      .eq("profile_id", profil.id)
      .limit(1000),
    chargerPaliers(supabase),
  ]);
  const classe = Boolean(rating?.est_classe);
  return {
    pseudo: profil.pseudo,
    slug: profil.slug,
    pays: profil.pays,
    classe,
    rating: classe && rating ? arrondir(Number(rating.rating)) : null,
    palier: classe && rating ? (trouverPalier(Number(rating.rating), paliers)?.nom ?? null) : null,
    confiancePct: rating ? calibrationPct(Number(rating.rd)) : 0,
    matchsJoues: rating?.matchs_joues ?? 0,
    matchsVerifies: (participations ?? []).filter((p) =>
      (p.match?.match_verdicts ?? []).some((v) => v.est_definitif && v.niveau !== "manuel"),
    ).length,
    url: `${URL_PUBLIQUE}/joueur/${profil.slug}`,
  };
}

export interface ParticipantPublic {
  nom: string;
  /** Adresse du CV (1v1) ; nulle pour une équipe. */
  slug: string | null;
  score: number;
  gagnant: boolean | null;
}

export interface MatchPublic {
  tour: number;
  position: number;
  participants: ParticipantPublic[];
  /** Verdict définitif ; `verifie` faux pour une décision manuelle. */
  verdict: { niveau: string; verifie: boolean } | null;
}

export interface TournoiPublic {
  slug: string;
  nom: string;
  statut: string;
  format: string;
  capacite: number;
  region: string;
  debuteLe: string;
  url: string;
  matchs: MatchPublic[];
}

export async function chargerTournoiPublic(supabase: Client, slug: string): Promise<TournoiPublic | null> {
  const { data: tournoi } = verifier(
    await supabase
      .from("tournaments")
      .select("id, slug, nom, statut, format, capacite, region, debute_le")
      .eq("slug", slug)
      .maybeSingle(),
  );
  if (!tournoi || !estVisiblePubliquement(tournoi.statut)) return null;

  const [{ data: matchs }, equipes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "tour, position, match_participants(profile_id, slot, score, est_gagnant, profile:profiles(pseudo, slug)), match_verdicts(niveau, est_definitif)",
      )
      .eq("tournament_id", tournoi.id)
      .order("tour", { ascending: true })
      .order("position", { ascending: true }),
    tournoi.format === "5v5" ? chargerEquipesDesTournois(supabase, [tournoi.id]) : Promise.resolve(null),
  ]);

  return {
    slug: tournoi.slug,
    nom: tournoi.nom,
    statut: tournoi.statut,
    format: tournoi.format,
    capacite: tournoi.capacite,
    region: tournoi.region,
    debuteLe: tournoi.debute_le,
    url: `${URL_PUBLIQUE}/lol/tournois/${tournoi.slug}`,
    matchs: (matchs ?? []).map((m) => {
      const verdict = m.match_verdicts.find((v) => v.est_definitif);
      return {
        tour: m.tour,
        position: m.position,
        participants: [...m.match_participants]
          .sort((a, b) => a.slot - b.slot)
          .map((p) => {
            const equipe = equipes?.get(cleEquipe(tournoi.id, p.profile_id));
            return {
              nom: equipe?.libelle ?? p.profile?.pseudo ?? "Joueur",
              slug: equipe ? null : (p.profile?.slug ?? null),
              score: p.score,
              gagnant: p.est_gagnant,
            };
          }),
        verdict: verdict ? { niveau: verdict.niveau, verifie: verdict.niveau !== "manuel" } : null,
      };
    }),
  };
}
