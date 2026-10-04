import { ImageResponse } from "next/og";
import { creerClientPublic } from "@/lib/supabase/public";
import { estVisiblePubliquement } from "@/lib/tournois";
import { ContenuAfficheTournoi, ContenuIntrouvable, ressourcesImage, type AfficheTournoi } from "@/lib/image-partage";

// Affiche partageable d'un tournoi (28/09/2026, audit N7) : nom, date à
// l'heure de Paris, format, et le vainqueur une fois le tournoi terminé.
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
