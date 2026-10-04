import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { modulesQrCode } from "./qr-code";

// Le QR code est relu par un décodeur indépendant : il doit redonner
// exactement le lien du certificat.
function relire(texte: string): string | null {
  const { taille, estSombre } = modulesQrCode(texte);
  const echelle = 8;
  const marge = 4;
  const cote = (taille + 2 * marge) * echelle;
  const pixels = new Uint8ClampedArray(cote * cote * 4).fill(255);
  for (let y = 0; y < cote; y++) {
    for (let x = 0; x < cote; x++) {
      const ligne = Math.floor(y / echelle) - marge;
      const colonne = Math.floor(x / echelle) - marge;
      if (ligne >= 0 && colonne >= 0 && ligne < taille && colonne < taille && estSombre(ligne, colonne)) {
        const i = (y * cote + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
    }
  }
  return jsQR(pixels, cote, cote)?.data ?? null;
}

describe("modulesQrCode", () => {
  it("encode le lien du certificat, relu tel quel", () => {
    const lien = "https://najarena.vercel.app/certificat/1a2b3c4d5e6f";
    expect(relire(lien)).toBe(lien);
  });

  it("dessine les trois carrés de repérage", () => {
    const { taille, chemin } = modulesQrCode("https://najarena.vercel.app/certificat/x");
    expect(taille).toBeGreaterThanOrEqual(21);
    expect(chemin).toContain("M0 0h1v1h-1z");
    expect(chemin).toContain(`M${taille - 1} 0h1v1h-1z`);
    expect(chemin).toContain(`M0 ${taille - 1}h1v1h-1z`);
  });
});
