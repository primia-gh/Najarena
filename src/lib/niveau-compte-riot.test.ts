import { describe, expect, it } from "vitest";
import { listeFrancaise, matchsSansPoints, NIVEAU_COMPTE_RIOT_MIN, niveauCompteSuffisant, niveauMinimumSerie, verdictCompteAuCV } from "./niveau-compte-riot";

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

describe("textes", () => {
  it("accorde le nombre de matchs", () => {
    expect(matchsSansPoints(1)).toBe("1 match sans points");
    expect(matchsSansPoints(3)).toBe("3 matchs sans points");
  });

  it("liste à la française : virgules, puis « et » avant le dernier", () => {
    expect(listeFrancaise(["A"])).toBe("A");
    expect(listeFrancaise(["A", "B"])).toBe("A et B");
    expect(listeFrancaise(["A", "B", "C"])).toBe("A, B et C");
    expect(listeFrancaise([])).toBe("");
  });
});

describe("verdictCompteAuCV", () => {
  const v = (niveau: string, niveau_compte_min: number | null, est_definitif = true) => ({ niveau, niveau_compte_min, est_definitif });
  it("lu chez Riot, comptes de niveau 30 : compte", () => {
    expect(verdictCompteAuCV(v("historique", 45))).toBe(true);
    expect(verdictCompteAuCV(v("code_tournoi", 30), 120)).toBe(true);
  });
  it("niveau vide (avant la règle, 5v5) : compte", () => {
    expect(verdictCompteAuCV(v("historique", null), null)).toBe(true);
  });
  it("verdict manuel, ou pas définitif : ne compte pas", () => {
    expect(verdictCompteAuCV(v("manuel", null))).toBe(false);
    expect(verdictCompteAuCV(v("historique", 80, false))).toBe(false);
  });
  it("compte sous le niveau 30, dans le verdict ou dans la fiche de partie : ne compte pas", () => {
    expect(verdictCompteAuCV(v("historique", 12))).toBe(false);
    expect(verdictCompteAuCV(v("historique", null), 12)).toBe(false);
  });
});
