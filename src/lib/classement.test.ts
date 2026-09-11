import { describe, expect, it } from "vitest";
import { arrondir, calibrationPct, trouverPalier } from "./classement";

describe("arrondir", () => {
  it("arrondit au plus proche entier", () => {
    expect(arrondir(1500.49)).toBe(1500);
    expect(arrondir(1500.5)).toBe(1501);
    expect(arrondir(349.27)).toBe(349);
  });
});

describe("calibrationPct", () => {
  it("0% au RD initial (350, joueur jamais calibré)", () => {
    expect(calibrationPct(350)).toBe(0);
  });

  it("100% au seuil de classement (RD 150, CLAUDE.md §4)", () => {
    expect(calibrationPct(150)).toBe(100);
  });

  it("50% à mi-chemin (RD 250)", () => {
    expect(calibrationPct(250)).toBe(50);
  });

  it("reste borné à [0, 100] même hors plage (RD > 350 ou < 150)", () => {
    expect(calibrationPct(400)).toBe(0);
    expect(calibrationPct(100)).toBe(100);
  });
});

describe("trouverPalier", () => {
  // Seuils fixes CLAUDE.md §4 : Bronze < 1300 · Argent 1300 · Or 1450 ·
  // Platine 1600 · Diamant 1750 · Champion 1900+.
  const paliers = [
    { nom: "Bronze", ratingMin: 0 },
    { nom: "Argent", ratingMin: 1300 },
    { nom: "Or", ratingMin: 1450 },
    { nom: "Platine", ratingMin: 1600 },
    { nom: "Diamant", ratingMin: 1750 },
    { nom: "Champion", ratingMin: 1900 },
  ];

  it("classe un rating exactement à un seuil dans le palier de ce seuil", () => {
    expect(trouverPalier(1300, paliers)?.nom).toBe("Argent");
    expect(trouverPalier(1900, paliers)?.nom).toBe("Champion");
  });

  it("classe un rating juste sous un seuil dans le palier inférieur", () => {
    expect(trouverPalier(1299, paliers)?.nom).toBe("Bronze");
    expect(trouverPalier(1449, paliers)?.nom).toBe("Argent");
  });

  it("ne dépend pas de l'ordre des paliers en entrée", () => {
    const melanges = [...paliers].reverse();
    expect(trouverPalier(1600, melanges)?.nom).toBe("Platine");
  });

  it("renvoie null si aucun palier ne couvre ce rating", () => {
    expect(trouverPalier(500, paliers.filter((p) => p.nom !== "Bronze"))).toBeNull();
  });
});
