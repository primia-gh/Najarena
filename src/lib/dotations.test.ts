import { afterEach, describe, expect, it, vi } from "vitest";
import { cashPrizesActifs, formaterEuros, lireRepartition } from "./dotations";

describe("cashPrizesActifs", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("éteint par défaut, allumé seulement avec CASH_PRIZES_ACTIFS=1", () => {
    vi.stubEnv("CASH_PRIZES_ACTIFS", "");
    expect(cashPrizesActifs()).toBe(false);
    vi.stubEnv("CASH_PRIZES_ACTIFS", "oui");
    expect(cashPrizesActifs()).toBe(false);
    vi.stubEnv("CASH_PRIZES_ACTIFS", "1");
    expect(cashPrizesActifs()).toBe(true);
  });
});

describe("lireRepartition", () => {
  it("lit des euros par rang, en centimes", () => {
    expect(lireRepartition("100, 50, 25")).toEqual([10000, 5000, 2500]);
    expect(lireRepartition("12.50 €; 5")).toEqual([1250, 500]);
  });

  it("refuse une saisie invalide", () => {
    expect(lireRepartition("")).toBeNull();
    expect(lireRepartition("100, 0")).toBeNull();
    expect(lireRepartition("1, 2, 3, 4, 5")).toBeNull();
    expect(lireRepartition("cent")).toBeNull();
  });
});

describe("formaterEuros", () => {
  it("affiche des euros à la française", () => {
    expect(formaterEuros(10000).replace(/\s/g, " ")).toBe("100 €");
    expect(formaterEuros(1250).replace(/\s/g, " ")).toBe("12,50 €");
  });
});
