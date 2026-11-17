import { describe, expect, it } from "vitest";
import { chancesDeTitre, formaterChance, type MatchTitre } from "./chances-titre";
import { ETAT_DE_DEPART, type EtatRating } from "./estimations";

const egal = (): EtatRating => ETAT_DE_DEPART;

function bracket4(gagnants: Partial<Record<string, string>> = {}): MatchTitre[] {
  return [
    { tour: 1, position: 1, joueurs: [{ profileId: "A", slot: 1 }, { profileId: "B", slot: 2 }], gagnant: gagnants["1-1"] ?? null },
    { tour: 1, position: 2, joueurs: [{ profileId: "C", slot: 1 }, { profileId: "D", slot: 2 }], gagnant: gagnants["1-2"] ?? null },
    { tour: 2, position: 1, joueurs: [], gagnant: gagnants["2-1"] ?? null },
  ];
}

function somme(m: Map<string, number>): number {
  return [...m.values()].reduce((a, b) => a + b, 0);
}

describe("chancesDeTitre", () => {
  it("quatre joueurs de même niveau : 25 % chacun", () => {
    const chances = chancesDeTitre(bracket4(), egal, true);
    for (const j of ["A", "B", "C", "D"]) expect(chances.get(j)).toBeCloseTo(0.25, 6);
  });

  it("les résultats acquis comptent « maintenant », pas « avant »", () => {
    const matchs = bracket4({ "1-1": "A" });
    const maintenant = chancesDeTitre(matchs, egal, true);
    expect(maintenant.get("A")).toBeCloseTo(0.5, 6);
    expect(maintenant.has("B")).toBe(false);
    expect(chancesDeTitre(matchs, egal, false).get("B")).toBeCloseTo(0.25, 6);
    expect(somme(maintenant)).toBeCloseTo(1, 6);
  });

  it("le mieux classé a plus de chances, le total fait toujours 100 %", () => {
    const ratings: Record<string, EtatRating> = {
      A: { rating: 1900, rd: 60 },
      B: { rating: 1500, rd: 60 },
      C: { rating: 1500, rd: 60 },
      D: { rating: 1400, rd: 60 },
    };
    const chances = chancesDeTitre(bracket4(), (id) => ratings[id], false);
    expect(chances.get("A")!).toBeGreaterThan(0.5);
    expect(chances.get("D")!).toBeLessThan(chances.get("C")!);
    expect(somme(chances)).toBeCloseTo(1, 6);
  });

  it("un joueur sans adversaire au premier tour (bye) passe d'office", () => {
    const matchs: MatchTitre[] = [
      { tour: 1, position: 1, joueurs: [{ profileId: "A", slot: 1 }], gagnant: null },
      { tour: 1, position: 2, joueurs: [{ profileId: "C", slot: 1 }, { profileId: "D", slot: 2 }], gagnant: null },
      { tour: 2, position: 1, joueurs: [], gagnant: null },
    ];
    const chances = chancesDeTitre(matchs, egal, false);
    expect(chances.get("A")).toBeCloseTo(0.5, 6);
    expect(chances.get("C")).toBeCloseTo(0.25, 6);
  });

  it("tournoi terminé : 100 % pour le vainqueur", () => {
    const chances = chancesDeTitre(bracket4({ "1-1": "A", "1-2": "D", "2-1": "D" }), egal, true);
    expect([...chances]).toEqual([["D", 1]]);
  });
});

describe("formaterChance", () => {
  it("arrondit et borne", () => {
    expect(formaterChance(0.234)).toBe("23 %");
    expect(formaterChance(0.001)).toBe("< 1 %");
    expect(formaterChance(0.999)).toBe("> 99 %");
    expect(formaterChance(0)).toBe("—");
    expect(formaterChance(undefined)).toBe("—");
  });
});
