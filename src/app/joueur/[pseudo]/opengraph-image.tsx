import { ImageResponse } from "next/og";
import { creerClientPublic } from "@/lib/supabase/public";
import { arrondir, calibrationPct, progressionPalier, RD_INITIAL } from "@/lib/classement";
import { ContenuCarteProfil, ContenuIntrouvable, ressourcesImage, type CarteProfil } from "@/lib/image-partage";

// Carte CV partageable (28/09/2026, audit N7) : ce qui s'affiche quand on
// colle le lien d'un profil sur Discord, X, WhatsApp ou LinkedIn. Mêmes
// chiffres que la page (rating, palier, confiance, matchs vérifiés), lus
// comme un visiteur déconnecté ; recalculée au plus toutes les heures.
export const alt = "CV e-sport Najarena : rating, palier et matchs vérifiés";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

async function chargerCarte(slug: string): Promise<CarteProfil | null> {
  const supabase = creerClientPublic();

  let { data: profil } = await supabase
    .from("profiles")
    .select("id, pseudo, slug")
    .eq("slug", slug)
    .is("supprime_le", null)
    .maybeSingle();
  if (!profil) {
    // Ancienne adresse d'un joueur qui a changé de pseudo.
    const { data: ancien } = await supabase
      .from("anciens_slugs")
      .select("profil:profiles(id, pseudo, slug)")
      .eq("slug", slug)
      .maybeSingle();
    profil = ancien?.profil ?? null;
  }
  if (!profil) return null;

  const [{ data: compte }, { data: rating }, { data: paliersData }, { data: participations }] = await Promise.all([
    supabase
      .from("game_accounts")
      .select("verifie_le")
      .eq("profile_id", profil.id)
      .eq("est_principal", true)
      .maybeSingle(),
    supabase
      .from("ratings")
      .select("rating, rd, est_classe")
      .eq("profile_id", profil.id)
      .eq("game_id", 1)
      .order("maj_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
    // 1v1 seulement : un match 5v5 n'est pas un résultat individuel (audit N21).
    supabase
      .from("match_participants")
      .select("match_id, est_gagnant, match:matches!inner(tournament:tournaments!inner(format))")
      .eq("profile_id", profil.id)
      .eq("match.tournament.format", "1v1"),
  ]);

  const ids = (participations ?? []).map((p) => p.match_id);
  const { data: verdicts } =
    ids.length > 0
      ? await supabase.from("match_verdicts").select("match_id, niveau").in("match_id", ids).eq("est_definitif", true)
      : { data: [] };
  const verifies = new Set((verdicts ?? []).filter((v) => v.niveau !== "manuel").map((v) => v.match_id));
  const joues = (participations ?? []).filter((p) => verifies.has(p.match_id));

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const palier = rating ? progressionPalier(rating.rating, paliers).palier : null;

  return {
    pseudo: profil.pseudo,
    slug: profil.slug,
    compteVerifie: Boolean(compte?.verifie_le),
    rating: rating ? arrondir(rating.rating) : null,
    estClasse: Boolean(rating?.est_classe),
    confiance: calibrationPct(rating?.rd ?? RD_INITIAL),
    palier,
    matchsVerifies: joues.length,
    victoires: joues.filter((p) => p.est_gagnant).length,
  };
}

export default async function Image({ params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  const [carte, { logo, options }] = await Promise.all([chargerCarte(pseudo), ressourcesImage()]);
  return new ImageResponse(
    carte ? (
      <ContenuCarteProfil carte={carte} logo={logo} />
    ) : (
      <ContenuIntrouvable logo={logo} rubrique="CV E-SPORT" titre="PROFIL INTROUVABLE" chemin="" />
    ),
    options,
  );
}
