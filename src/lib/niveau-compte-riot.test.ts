import { describe, expect, it } from "vitest";
import { NIVEAU_COMPTE_RIOT_MIN, niveauCompteSuffisant, niveauMinimumSerie } from "./niveau-compte-riot";

describe("niveau Riot minimum pour le classement", () => {
  it("le seuil est le niveau 30", () => {
    expect(NIVEAU_COMPTE_RIOT_MIN).toBe(30);
  });

  it("compte à partir du niveau 30, pas en dessous", () => {
    expect(niveauCompteSuffisant(30)).toBe(true);
    expect(niveauCompteSuffisant(412)).toBe(true);
    expect(niveauCompteSuffisant(29)).toBe(false);
    expect(niveauCompteSuffisant(1)).toBe(false);
  });

  it("un verdict sans niveau (avant la règle, 5v5) compte comme avant", () => {
    expect(niveauCompteSuffisant(null)).toBe(true);
    expect(niveauCompteSuffisant(undefined)).toBe(true);
  });

  it("garde le plus bas niveau de la série", () => {
    expect(niveauMinimumSerie([120, 31, 87, 45])).toBe(31);
    expect(niveauMinimumSerie([12, 300])).toBe(12);
  });

  it("niveau inconnu pour un compte, ou série vide : nul", () => {
    expect(niveauMinimumSerie([120, undefined])).toBeNull();
    expect(niveauMinimumSerie([])).toBeNull();
    expect(niveauMinimumSerie([Number.NaN, 40])).toBeNull();
  });
});
