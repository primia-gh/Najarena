import { describe, expect, it } from "vitest";
import { disposerBracket, libelleTour, tronquer, type MatchImage } from "./bracket-image";

function bracket(tours: number): MatchImage[] {
  const matchs: MatchImage[] = [];
  for (let tour = 1; tour <= tours; tour++) {
    for (let position = 1; position <= 2 ** (tours - tour); position++) {
      matchs.push({ tour, position, joueurs: [`A${tour}${position}`, `B${tour}${position}`], gagnant: 0 });
    }
  }
  return matchs;
}

describe("disposerBracket", () => {
  it("garde les trois derniers tours d'un grand bracket", () => {
    const { boites, colonnes } = disposerBracket(bracket(5), 600, 360);
    expect(colonnes.map((c) => c.libelle)).toEqual(["QUARTS", "DEMI-FINALES", "FINALE"]);
    expect(boites).toHaveLength(4 + 2 + 1);
    expect(new Set(boites.map((b) => b.match.tour))).toEqual(new Set([3, 4, 5]));
  });

  it("centre la finale entre les deux demi-finales", () => {
    const { boites } = disposerBracket(bracket(2), 600, 360);
    const centre = (b: (typeof boites)[number]) => b.y + b.hauteur / 2;
    const [demi1, demi2, finale] = boites;
    expect(centre(finale)).toBeCloseTo((centre(demi1) + centre(demi2)) / 2);
    expect(finale.x).toBeGreaterThan(demi1.x + demi1.largeur);
  });

  it("relie chaque match au suivant, sans déborder du cadre", () => {
    const { boites, traits } = disposerBracket(bracket(3), 600, 360);
    // 4 quarts + 2 demies : 2 traits chacun, plus un trait d'arrivée par match suivant (2 demies + finale).
    expect(traits).toHaveLength(6 * 2 + 3);
    for (const element of [...boites, ...traits]) {
      expect(element.x).toBeGreaterThanOrEqual(0);
      expect(element.y).toBeGreaterThanOrEqual(-1);
      expect(element.x + element.largeur).toBeLessThanOrEqual(600 + 0.001);
      expect(element.y + element.hauteur).toBeLessThanOrEqual(361);
    }
  });

  it("ne fait pas traverser toute l'image à la case d'un duel", () => {
    const { boites } = disposerBracket([{ tour: 1, position: 1, joueurs: ["A", "B"], gagnant: null }], 600, 360);
    expect(boites[0].largeur).toBeLessThanOrEqual(240);
  });

  it("supporte une place vide (exempt) et un bracket vide", () => {
    const sansQuart = bracket(3).filter((m) => !(m.tour === 1 && m.position === 2));
    const { boites, traits } = disposerBracket(sansQuart, 600, 360);
    expect(boites).toHaveLength(6);
    expect(traits).toHaveLength(5 * 2 + 3);
    expect(disposerBracket([], 600, 360).boites).toEqual([]);
  });
});

describe("libellés", () => {
  it("nomme les tours depuis la finale", () => {
    expect(libelleTour(4, 4)).toBe("FINALE");
    expect(libelleTour(3, 4)).toBe("DEMI-FINALES");
    expect(libelleTour(2, 4)).toBe("QUARTS");
    expect(libelleTour(1, 4)).toBe("TOUR 1");
  });

  it("coupe les noms trop longs", () => {
    expect(tronquer("Viper Main", 16)).toBe("Viper Main");
    expect(tronquer("[BRN] Les Barons du mardi soir", 16)).toBe("[BRN] Les Baron…");
  });
});
