import { describe, expect, it } from "vitest";
import { nombreRondes, recitSuisse, type LigneClassementSuisse } from "./suisse";

describe("nombreRondes", () => {
  it("⌈log2 n⌉, de 1 à 5", () => {
    expect(nombreRondes(1)).toBe(0);
    expect(nombreRondes(2)).toBe(1);
    expect(nombreRondes(7)).toBe(3);
    expect(nombreRondes(8)).toBe(3);
    expect(nombreRondes(9)).toBe(4);
    expect(nombreRondes(64)).toBe(5);
  });
});

function ligne(rang: number, pseudo: string, victoires: number, defaites: number, buchholz: number): LigneClassementSuisse {
  return { profile_id: pseudo, pseudo, slug: pseudo.toLowerCase(), victoires, defaites, buchholz, rang };
}

describe("recitSuisse", () => {
  it("vainqueur, bilan et dauphin départagé au Buchholz", () => {
    const r = recitSuisse("Coupe", 3, [ligne(1, "Ahri", 3, 0, 5), ligne(2, "Zed", 3, 0, 4), ligne(3, "Lux", 1, 2, 3)]);
    expect(r?.[0]).toBe("Ahri remporte Coupe au format suisse (3 joueurs, 3 rondes) avec 3 victoires et 0 défaite.");
    expect(r?.[1]).toMatch(/même bilan.*Buchholz 5 contre 4/);
  });

  it("rien sans classement", () => {
    expect(recitSuisse("Coupe", 3, [])).toBeNull();
  });
});
