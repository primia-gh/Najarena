import { describe, expect, it } from "vitest";
import { slugifier } from "./slug";

describe("slugifier", () => {
  it("met en minuscules et remplace les espaces par des tirets", () => {
    expect(slugifier("Robbie Kammerer")).toBe("robbie-kammerer");
  });

  it("retire les accents (normalisation NFD)", () => {
    expect(slugifier("Éléonore Müller")).toBe("eleonore-muller");
  });

  it("remplace toute suite de caractères non alphanumériques par un seul tiret", () => {
    expect(slugifier("Ro2b!! le_boss__2026")).toBe("ro2b-le-boss-2026");
  });

  it("retire les tirets en début et fin de chaîne", () => {
    expect(slugifier("  -Ro2b-  ")).toBe("ro2b");
  });

  it("renvoie une chaîne vide pour une entrée sans caractère alphanumérique", () => {
    expect(slugifier("!!!")).toBe("");
    expect(slugifier("")).toBe("");
  });

  it("conserve les chiffres", () => {
    expect(slugifier("Tournoi2026")).toBe("tournoi2026");
  });
});
