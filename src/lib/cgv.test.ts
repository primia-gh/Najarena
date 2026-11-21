import { describe, expect, it } from "vitest";
import { formaterPrixEuros, periodePrix } from "./cgv";

describe("formaterPrixEuros", () => {
  it("écrit les centimes en euros à la française", () => {
    expect(formaterPrixEuros(399)).toBe("3,99 €");
    expect(formaterPrixEuros(1000)).toBe("10,00 €");
  });
});

describe("periodePrix", () => {
  it("mensuel ou annuel seulement", () => {
    expect(periodePrix("month", 1)).toBe("/mois");
    expect(periodePrix("year", 1)).toBe("/an");
    expect(periodePrix("month", 3)).toBeNull();
    expect(periodePrix("week", 1)).toBeNull();
  });
});
