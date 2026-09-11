import { describe, expect, it } from "vitest";
import { ordreDesSeeds } from "./bracket";

describe("ordreDesSeeds", () => {
  it("capacité 1 : un seul seed", () => {
    expect(ordreDesSeeds(1)).toEqual([1]);
  });

  it("capacité 4 : seed1 vs seed4, seed2 vs seed3 (exemple de référence du commentaire)", () => {
    expect(ordreDesSeeds(4)).toEqual([1, 4, 2, 3]);
  });

  it.each([4, 8, 16, 32, 64])(
    "capacité %i : contient chaque seed de 1 à la capacité exactement une fois",
    (capacite) => {
      const ordre = ordreDesSeeds(capacite);
      expect(ordre).toHaveLength(capacite);
      expect(new Set(ordre).size).toBe(capacite);
      expect([...ordre].sort((a, b) => a - b)).toEqual(
        Array.from({ length: capacite }, (_, i) => i + 1),
      );
    },
  );

  it.each([4, 8, 16, 32, 64])(
    "capacité %i : chaque paire de premier tour se somme à capacité+1 (chaque match oppose le meilleur et le pire seed restants)",
    (capacite) => {
      const ordre = ordreDesSeeds(capacite);
      for (let i = 0; i < capacite; i += 2) {
        expect(ordre[i] + ordre[i + 1]).toBe(capacite + 1);
      }
    },
  );

  it("capacité 8 avec 5 joueurs confirmés : aucun match du tour 1 ne se retrouve à 0 participant (bug #1 corrigé le 2026-09-11)", () => {
    // Repro exacte de la régression : moins de joueurs confirmés que de
    // places, un ordre naïf (seed = position) pouvait placer deux seeds
    // absents côte à côte dans le même match.
    const capacite = 8;
    const nbJoueurs = 5;
    const ordre = ordreDesSeeds(capacite);

    for (let position = 0; position < capacite / 2; position++) {
      const seedA = ordre[position * 2];
      const seedB = ordre[position * 2 + 1];
      const participants = [seedA, seedB].filter((s) => s <= nbJoueurs).length;
      expect(participants).toBeGreaterThan(0);
    }
  });
});
