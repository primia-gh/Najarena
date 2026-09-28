import { ImageResponse } from "next/og";
import { creerClientPublic } from "@/lib/supabase/public";
import { calibrationPct } from "@/lib/classement";
import { ContenuCarteProfil, ContenuIntrouvable, ressourcesImage } from "@/lib/image-partage";

// Image de partage d'un certificat de niveau (audit N9) : la carte CV, figée
// à la date du certificat.
export const alt = "Certificat de niveau Najarena : rating, palier et matchs vérifiés à une date donnée";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = creerClientPublic();
  const [{ data: c }, { logo, options }] = await Promise.all([
    supabase.rpc("lire_certificat", { p_code: code }).maybeSingle(),
    ressourcesImage(),
  ]);

  if (!c || c.compte_supprime) {
    return new ImageResponse(
      <ContenuIntrouvable logo={logo} rubrique="CERTIFICAT" titre="CERTIFICAT INTROUVABLE" chemin="" />,
      options,
    );
  }

  const { data: compte } = await supabase
    .from("game_accounts")
    .select("verifie_le")
    .eq("profile_id", c.profile_id)
    .eq("est_principal", true)
    .maybeSingle();

  return new ImageResponse(
    (
      <ContenuCarteProfil
        logo={logo}
        rubrique={`CERTIFICAT DE NIVEAU · ${DATE.format(new Date(c.cree_le))}`}
        chemin={`/certificat/${c.code}`}
        carte={{
          pseudo: c.pseudo,
          slug: c.slug,
          compteVerifie: Boolean(compte?.verifie_le),
          rating: Math.round(c.rating),
          estClasse: c.est_classe,
          confiance: calibrationPct(c.rd),
          palier: c.palier ? { nom: c.palier, ratingMin: 0 } : null,
          matchsVerifies: c.matchs_verifies,
          victoires: c.victoires,
        }}
      />
    ),
    options,
  );
}
