import { describe, expect, it } from "vitest";
import { RD_INITIAL, RD_SEUIL_CLASSEMENT } from "@/lib/classement";
import {
  MATCH_SEUIL_ILLUSTRATION,
  MATCHS_ILLUSTRATION,
  PLANCHER_ILLUSTRATION,
  RD_MAX_ILLUSTRATION,
  rdIllustration,
} from "./schemas-calibration";

// Schéma « L'incertitude qui fond » : l'illustration doit rester fidèle à
// la règle (départ à RD_INITIAL, entrée au classement vers le 10e match).

describe("courbe d'illustration de la calibration", () => {
  it("garde des constantes compatibles avec la règle du classement", () => {
    expect(PLANCHER_ILLUSTRATION).toBeLessThan(RD_SEUIL_CLASSEMENT);
    expect(RD_SEUIL_CLASSEMENT).toBeLessThan(RD_INITIAL);
    expect(RD_INITIAL).toBeLessThanOrEqual(RD_MAX_ILLUSTRATION);
  });

  it("part de RD_INITIAL", () => {
    expect(rdIllustration(0)).toBeCloseTo(RD_INITIAL, 9);
  });

  it("atteint le seuil d'entrée au 10e match, pas avant", () => {
    expect(rdIllustration(MATCH_SEUIL_ILLUSTRATION - 1)).toBeGreaterThan(RD_SEUIL_CLASSEMENT);
    expect(rdIllustration(MATCH_SEUIL_ILLUSTRATION)).toBeLessThanOrEqual(RD_SEUIL_CLASSEMENT + 1e-9);
  });

  it("descend toujours, sans valeur invalide", () => {
    let avant = Infinity;
    for (let m = 0; m <= MATCHS_ILLUSTRATION; m++) {
      const rd = rdIllustration(m);
      expect(Number.isFinite(rd)).toBe(true);
      expect(rd).toBeLessThan(avant);
      expect(rd).toBeGreaterThan(PLANCHER_ILLUSTRATION);
      avant = rd;
    }
  });
});
