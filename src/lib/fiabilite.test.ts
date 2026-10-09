import { describe, expect, it } from "vitest";
import { formaterDelai, lignesFiabilite, type DonneesFiabilite } from "./fiabilite";

const base: DonneesFiabilite = {
  tournois: 0,
  checkins: 0,
  matchs_prets: 0,
  delai_pret_median_secondes: null,
  matchs_joues: 0,
  forfaits: 0,
  defaites_reconnues: 0,
};

describe("lignesFiabilite", () => {
  it("n'affiche rien sur trop peu de données", () => {
    expect(lignesFiabilite(base)).toEqual([]);
    expect(lignesFiabilite({ ...base, tournois: 2, checkins: 2, matchs_joues: 2, defaites_reconnues: 1 })).toEqual([]);
  });

  it("donne un compte brut sous 5 tournois, un pourcentage au-delà", () => {
    expect(lignesFiabilite({ ...base, tournois: 4, checkins: 3 })[0]).toEqual({
      libelle: "Présent au check-in",
      valeur: "3 tournois sur 4",
    });
    expect(lignesFiabilite({ ...base, tournois: 10, checkins: 9 })[0].valeur).toBe("90 % des tournois (9 sur 10)");
  });

  it("décrit la rapidité, les forfaits et les défaites reconnues", () => {
    const lignes = lignesFiabilite({
      ...base,
      matchs_prets: 12,
      delai_pret_median_secondes: 185,
      matchs_joues: 14,
      forfaits: 0,
      defaites_reconnues: 2,
    });
    expect(lignes).toEqual([
      { libelle: "Prêt à jouer", valeur: "en 3 min après l'ouverture du match (médiane, 12 matchs)" },
      { libelle: "Forfaits", valeur: "aucun sur 14 matchs" },
      { libelle: "Défaites reconnues", valeur: "2, sans attendre la lecture Riot" },
    ]);
  });
});

describe("formaterDelai", () => {
  it("arrondit à la minute", () => {
    expect(formaterDelai(30)).toBe("moins d'une minute");
    expect(formaterDelai(185)).toBe("3 min");
    expect(formaterDelai(3900)).toBe("1 h 05");
  });
});
