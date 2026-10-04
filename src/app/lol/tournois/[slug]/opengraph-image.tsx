import { ImageResponse } from "next/og";
import { creerClientPublic } from "@/lib/supabase/public";
import { estVisiblePubliquement } from "@/lib/tournois";
import { ContenuAfficheTournoi, ContenuIntrouvable, ressourcesImage, type AfficheTournoi } from "@/lib/image-partage";
import type { MatchImage } from "@/lib/bracket-image";
import { libelleEquipe } from "@/lib/cinq-contre-cinq";

// Affiche partageable d'un tournoi (28/09/2026, audit N7) : nom, date à
// l'heure de Paris, format, le bracket une fois lancé (trois derniers
// tours) et le vainqueur une fois le tournoi terminé.
export const alt = "Tournoi League of Legends sur Najarena";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 900;

async function chargerAffiche(slug: string): Promise<AfficheTournoi | null> {
  const supabase = creerClientPublic();
  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("id, slug, nom, format, capacite, region, statut, debute_le, best_of")
    .eq("slug", slug)
    .maybeSingle();
  if (!tournoi || !estVisiblePubliquement(tournoi.statut)) return null;

  let vainqueur: string | null = null;
  if (tournoi.statut === "termine") {
    const { data: finale } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament_id", tournoi.id)
      .is("match_suivant_id", null)
      .limit(1)
      .maybeSingle();
    if (finale) {
      const { data: verdict } = await supabase
        .from("match_verdicts")
        .select("gagnant:profiles!match_verdicts_gagnant_id_fkey(pseudo)")
        .eq("match_id", finale.id)
        .eq("est_definitif", true)
        .maybeSingle();
      vainqueur = verdict?.gagnant?.pseudo ?? null;
    }
  }

  // Bracket lancé : chaque match avec ses deux places et son vainqueur. En
  // 5v5, le capitaine représente son équipe : on affiche l'équipe.
  let bracket: MatchImage[] = [];
  if (tournoi.statut === "en_cours" || tournoi.statut === "termine") {
    const [{ data: matchs }, { data: equipes }] = await Promise.all([
      supabase
        .from("matches")
        .select("tour, position, match_participants(profile_id, slot, est_gagnant, profile:profiles(pseudo))")
        .eq("tournament_id", tournoi.id),
      tournoi.format === "5v5"
        ? supabase
            .from("registrations")
            .select("profile_id, equipe_nom, equipe_tag")
            .eq("tournament_id", tournoi.id)
            .neq("statut", "retire")
        : Promise.resolve({ data: [] }),
    ]);
    const equipeDe = new Map((equipes ?? []).map((e) => [e.profile_id, libelleEquipe(e.equipe_tag, e.equipe_nom)]));
    bracket = (matchs ?? []).map((m) => {
      const place = (slot: number) => m.match_participants.find((p) => p.slot === slot);
      const nom = (slot: number) => {
        const p = place(slot);
        return p ? (equipeDe.get(p.profile_id) ?? p.profile?.pseudo ?? "Joueur") : null;
      };
      return {
        tour: m.tour,
        position: m.position,
        joueurs: [nom(1), nom(2)],
        gagnant: place(1)?.est_gagnant ? 0 : place(2)?.est_gagnant ? 1 : null,
      };
    });
  }

  return {
    slug: tournoi.slug,
    nom: tournoi.nom,
    format: tournoi.format,
    capacite: tournoi.capacite,
    region: tournoi.region,
    statut: tournoi.statut,
    debuteLe: tournoi.debute_le,
    bestOf: tournoi.best_of,
    vainqueur,
    bracket,
  };
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [affiche, { logo, options }] = await Promise.all([chargerAffiche(slug), ressourcesImage()]);
  return new ImageResponse(
    affiche ? (
      <ContenuAfficheTournoi affiche={affiche} logo={logo} />
    ) : (
      <ContenuIntrouvable logo={logo} rubrique="TOURNOI" titre="TOURNOI INTROUVABLE" chemin="/lol/tournois" />
    ),
    options,
  );
}
