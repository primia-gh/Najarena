import { describe, expect, it } from "vitest";
import { probabiliteVictoire } from "./glicko2";
import { chancesSiExploit, ETAT_DE_DEPART, pourcentages } from "./estimations";

describe("chances estimées", () => {
  it("donne 50 % à deux joueurs de même niveau", () => {
    expect(probabiliteVictoire(ETAT_DE_DEPART, ETAT_DE_DEPART)).toBeCloseTo(0.5, 10);
    expect(pourcentages(ETAT_DE_DEPART, ETAT_DE_DEPART)).toEqual([50, 50]);
  });

  it("favorise le mieux classé, et les deux chances font 100 %", () => {
    const fort = { rating: 1800, rd: 60 };
    const moyen = { rating: 1600, rd: 60 };
    const p = probabiliteVictoire(fort, moyen);
    expect(p).toBeGreaterThan(0.7);
    expect(p + probabiliteVictoire(moyen, fort)).toBeCloseTo(1, 10);
    const [a, b] = pourcentages(fort, moyen);
    expect(a + b).toBe(100);
  });

  it("rapproche de 50 % quand les niveaux sont incertains", () => {
    const surs = probabiliteVictoire({ rating: 1800, rd: 50 }, { rating: 1600, rd: 50 });
    const incertains = probabiliteVictoire({ rating: 1800, rd: 300 }, { rating: 1600, rd: 300 });
    expect(incertains).toBeLessThan(surs);
    expect(incertains).toBeGreaterThan(0.5);
  });

  it("signale un exploit seulement quand le vainqueur avait moins de 35 % de chances", () => {
    expect(chancesSiExploit({ rating: 1500, rd: 60 }, { rating: 1750, rd: 60 })).toBeLessThan(35);
    expect(chancesSiExploit({ rating: 1600, rd: 60 }, { rating: 1620, rd: 60 })).toBeNull();
  });
});
