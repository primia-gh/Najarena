import { ImageResponse } from "next/og";
import { adresseAffichee, CadreImage, COULEURS, ressourcesImage } from "@/lib/image-partage";

// Image de partage par défaut (accueil et pages sans image propre).
export const alt = "Najarena — tournois League of Legends, ton niveau vérifié";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { logo, options } = await ressourcesImage();
  return new ImageResponse(
    (
      <CadreImage logo={logo} rubrique="LEAGUE OF LEGENDS · 1V1" adresse={adresseAffichee("")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontFamily: "Titre", fontWeight: 900, fontSize: 132, lineHeight: 0.9 }}>TON NIVEAU,</span>
          <span style={{ fontFamily: "Titre", fontWeight: 900, fontSize: 132, lineHeight: 0.9, color: COULEURS.accent }}>
            VÉRIFIÉ.
          </span>
          <span style={{ fontSize: 30, color: COULEURS.texte2, marginTop: 12 }}>
            Tournois quotidiens, classement Glicko-2, CV e-sport public.
          </span>
        </div>
      </CadreImage>
    ),
    options,
  );
}
