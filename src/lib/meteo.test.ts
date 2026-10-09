import { describe, expect, it } from "vitest";
import { etatMeteo, formaterDecimal, partVerifiee, type DonneesMeteo } from "./meteo";

const base: DonneesMeteo = {
  saison: "Saison 1",
  joueurs_avec_rating: 40,
  joueurs_classes: 10,
  rd_median: 200,
  joueurs_actifs_30j: 30,
  matchs_30j: 120,
  matchs_verifies_30j: 114,
  matchs_par_actif_median: 6,
};

describe("etatMeteo", () => {
  it("suit l'incertitude médiane des joueurs notés", () => {
    expect(etatMeteo({ ...base, rd_median: 140 })).toBe("solide");
    expect(etatMeteo({ ...base, rd_median: 150 })).toBe("solide");
    expect(etatMeteo({ ...base, rd_median: 200 })).toBe("en_construction");
    expect(etatMeteo({ ...base, rd_median: 320 })).toBe("jeune");
  });
  it("sans joueur noté : pas de données", () => {
    expect(etatMeteo({ ...base, joueurs_avec_rating: 0, rd_median: null })).toBe("sans_donnees");
  });
});

describe("partVerifiee", () => {
  it("en pourcentage entier, null sans match", () => {
    expect(partVerifiee(120, 114)).toBe(95);
    expect(partVerifiee(0, 0)).toBeNull();
  });
});

describe("formaterDecimal", () => {
  it("à la française", () => {
    expect(formaterDecimal(4.5)).toBe("4,5");
    expect(formaterDecimal(6)).toBe("6");
    expect(formaterDecimal(null)).toBe("—");
  });
});
