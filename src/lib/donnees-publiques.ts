import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { arrondir, calibrationPct, trouverPalier } from "@/lib/classement";
import { estMatchVide } from "@/lib/double-elim";
import { verdictCompteAuCV } from "@/lib/niveau-compte-riot";
import { estVisiblePubliquement } from "@/lib/tournois";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";
import {
  choisirMatchJoueur,
  etapeMatch,
  type MatchCandidat,
  type MatchOverlay,
  type StatutMatchOverlay,
} from "@/lib/overlay-match";

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
  /**
   * Matchs 1v1 dont le résultat a été lu chez Riot (niveaux 2 et 3), sans
   * ceux joués avec un compte Riot sous le niveau 30 (23/11/2026) : le même
   * chiffre que le CV (un match 5v5 n'est pas un résultat individuel).
   */
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
      .select("match:matches!inner(tournament:tournaments!inner(format), match_verdicts(niveau, est_definitif, niveau_compte_min))")
      .eq("profile_id", profil.id)
      .eq("match.tournament.format", "1v1")
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
      (p.match?.match_verdicts ?? []).some((v) => verdictCompteAuCV(v)),
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
  /** Double élimination : « gagnants », « perdants » ou « finale » ; nul sinon. */
  tableau: string | null;
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
        "tour, position, tableau, statut, match_participants(profile_id, slot, score, est_gagnant, profile:profiles(pseudo, slug)), match_verdicts(niveau, est_definitif)",
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
    // Double élimination (20/11/2026) : un match clos sans aucun joueur
    // (deux places d'origine vides) n'est pas publié.
    matchs: (matchs ?? []).filter((m) => !estMatchVide(m)).map((m) => {
      const verdict = m.match_verdicts.find((v) => v.est_definitif);
      return {
        tour: m.tour,
        position: m.position,
        tableau: m.tableau,
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

// Overlay de match pour les streams (21/11/2026) : un match précis, ou le
// match du moment d'un joueur. Mêmes règles que le reste : tournoi visible
// publiquement, rating seulement pour un joueur classé, verdict définitif
// seulement.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STATUTS_MATCH: readonly StatutMatchOverlay[] = ["en_attente", "en_cours", "termine", "litige", "forfait"];

export async function chargerMatchOverlay(supabase: Client, id: string): Promise<MatchOverlay | null> {
  if (!UUID.test(id)) return null;
  const { data: m } = verifier(
    await supabase
      .from("matches")
      .select(
        "id, tournament_id, tour, tableau, statut, match_participants(profile_id, slot, pret_le, profile:profiles(pseudo)), match_verdicts(niveau, gagnant_id, motif, decide_par, est_definitif), tournament:tournaments(id, nom, statut, format, nature, type_bracket, best_of)",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  const tournoi = m?.tournament;
  if (!m || !tournoi || !estVisiblePubliquement(tournoi.statut)) return null;
  // Match clos sans joueur (double élimination) : jamais publié, comme sur le bracket.
  if (estMatchVide(m)) return null;

  const participants = [...m.match_participants].sort((a, b) => a.slot - b.slot);
  const ids = participants.map((p) => p.profile_id);
  const [lectureTours, equipes, { data: ratings }, paliers] = await Promise.all([
    supabase.from("matches").select("tour, tableau").eq("tournament_id", tournoi.id),
    tournoi.format === "5v5" ? chargerEquipesDesTournois(supabase, [tournoi.id]) : Promise.resolve(null),
    tournoi.format === "1v1" && ids.length > 0
      ? supabase
          .from("ratings")
          .select("profile_id, rating, est_classe, season:seasons!inner(est_courante)")
          .in("profile_id", ids)
          .eq("game_id", 1)
          .eq("season.est_courante", true)
      : Promise.resolve({ data: [] }),
    tournoi.format === "1v1" ? chargerPaliers(supabase) : Promise.resolve([]),
  ]);

  // Sans les tours, l'étape serait fausse (« Finale » pour un premier tour) :
  // base injoignable = 503, jamais une bannière fausse mise en cache.
  const { data: tours } = verifier(lectureTours);
  const verdict = m.match_verdicts.find((v) => v.est_definitif);
  const toursDe = (filtre: (t: { tableau: string | null }) => boolean) =>
    Math.max(m.tour, ...(tours ?? []).filter(filtre).map((t) => t.tour));
  return {
    id: m.id,
    tournoi: tournoi.nom,
    etape: etapeMatch(
      { nature: tournoi.nature, typeBracket: tournoi.type_bracket },
      m.tour,
      m.tableau,
      toursDe((t) => t.tableau === null),
      toursDe((t) => t.tableau === "gagnants"),
    ),
    bestOf: tournoi.best_of,
    statut: STATUTS_MATCH.includes(m.statut) ? m.statut : "en_attente",
    tournoiAnnule: tournoi.statut === "annule",
    cotes: participants.map((p) => {
      const equipe = equipes?.get(cleEquipe(tournoi.id, p.profile_id));
      const rating = (ratings ?? []).find((r) => r.profile_id === p.profile_id);
      const palier = rating?.est_classe ? trouverPalier(Number(rating.rating), paliers)?.nom : null;
      return {
        nom: equipe?.libelle ?? p.profile?.pseudo ?? "Joueur",
        niveau: rating?.est_classe ? `${palier ? `${palier} · ` : ""}${arrondir(Number(rating.rating))}` : null,
        pret: p.pret_le !== null,
      };
    }),
    verdict: verdict
      ? {
          niveau: verdict.niveau,
          motif: verdict.niveau === "manuel" ? verdict.motif : null,
          // Un vainqueur absent des places (ne devrait pas arriver) n'est désigné nulle part.
          gagnant: verdict.gagnant_id && ids.includes(verdict.gagnant_id) ? ids.indexOf(verdict.gagnant_id) : null,
          sansVainqueur: verdict.gagnant_id === null,
          decideur:
            verdict.decide_par === null
              ? "automatique"
              : tournoi.nature === "defi" || tournoi.nature === "scrim"
                ? "arbitre"
                : "organisateur",
        }
      : null,
    urlPreuve: `${URL_PUBLIQUE}/lol/match/${m.id}`,
  };
}

/** Fenêtre de recherche du match d'un joueur : tournois commencés depuis deux jours. */
const FENETRE_OVERLAY_JOURS = 2;

export interface OverlayJoueur {
  pseudo: string;
  url: string;
  match: MatchOverlay | null;
}

export async function chargerOverlayJoueur(
  supabase: Client,
  slug: string,
  maintenant: Date = new Date(),
): Promise<OverlayJoueur | null> {
  const { data: profil } = verifier(
    await supabase.from("profiles").select("id, pseudo, slug, supprime_le").eq("slug", slug).maybeSingle(),
  );
  if (!profil || profil.supprime_le) return null;
  const url = `${URL_PUBLIQUE}/joueur/${profil.slug}`;

  // Tournois récents du joueur : inscrit lui-même (1v1, duel, capitaine),
  // ou aligné dans une équipe (5v5) — l'équipe y joue sous son capitaine.
  const depuis = new Date(maintenant.getTime() - FENETRE_OVERLAY_JOURS * 86_400_000).toISOString();
  const [lectureInscriptions, lectureAlignements] = await Promise.all([
    supabase
      .from("registrations")
      .select("tournament_id, tournament:tournaments!inner(debute_le)")
      .eq("profile_id", profil.id)
      .neq("statut", "retire")
      .gte("tournament.debute_le", depuis)
      .limit(50),
    supabase
      .from("alignements")
      .select("tournament_id, registration:registrations(profile_id), tournament:tournaments!inner(debute_le)")
      .eq("profile_id", profil.id)
      .gte("tournament.debute_le", depuis)
      .limit(50),
  ]);
  // Lecture ratée = 503, jamais « pas de match en cours » pendant un vrai match.
  const { data: inscriptions } = verifier(lectureInscriptions);
  const { data: alignements } = verifier(lectureAlignements);
  const representants = new Set<string>();
  for (const r of inscriptions ?? []) representants.add(`${r.tournament_id}:${profil.id}`);
  for (const a of alignements ?? []) {
    if (a.registration) representants.add(`${a.tournament_id}:${a.registration.profile_id}`);
  }
  if (representants.size === 0) return { pseudo: profil.pseudo, url, match: null };

  const tournois = [...new Set([...representants].map((r) => r.split(":")[0]))];
  const personnes = [...new Set([...representants].map((r) => r.split(":")[1]))];
  const { data: lignes } = verifier(
    await supabase
      .from("match_participants")
      .select(
        "profile_id, match:matches!inner(id, tournament_id, statut, demarre_le, match_participants(profile_id), match_verdicts(est_definitif, cree_le), tournament:tournaments(statut))",
      )
      .in("profile_id", personnes)
      .in("match.tournament_id", tournois)
      .limit(500),
  );

  const candidats: MatchCandidat[] = (lignes ?? []).flatMap((l) => {
    const m = l.match;
    if (!m || !representants.has(`${m.tournament_id}:${l.profile_id}`)) return [];
    return [
      {
        id: m.id,
        statut: STATUTS_MATCH.includes(m.statut) ? m.statut : "en_attente",
        tournoiEnCours: m.tournament?.statut === "en_cours",
        ouvertLe: m.demarre_le,
        verdictLe: m.match_verdicts.find((v) => v.est_definitif)?.cree_le ?? null,
        adversaireConnu: m.match_participants.length === 2,
      },
    ];
  });
  const choisi = choisirMatchJoueur(candidats, maintenant);
  return {
    pseudo: profil.pseudo,
    url,
    match: choisi ? await chargerMatchOverlay(supabase, choisi) : null,
  };
}
