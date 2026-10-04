import { describe, expect, it } from "vitest";
import { ecartArene, messageRefusArene, minutesEnFile } from "./arene";

describe("ecartArene", () => {
  it("part de 100 + la moitié du plus grand RD", () => {
    expect(ecartArene(100, 60, 0)).toBe(150);
    expect(ecartArene(60, 350, 0)).toBe(275);
  });

  it("s'élargit de 20 par minute d'attente, 500 au plus", () => {
    expect(ecartArene(350, 60, 10)).toBe(475);
    expect(ecartArene(350, 350, 60)).toBe(500);
    expect(ecartArene(100, 100, -5)).toBe(150);
  });
});

describe("minutesEnFile", () => {
  it("compte les minutes entières écoulées", () => {
    const maintenant = new Date("2026-10-03T20:10:30Z");
    expect(minutesEnFile("2026-10-03T20:00:00Z", maintenant)).toBe(10);
    expect(minutesEnFile("2026-10-03T20:20:00Z", maintenant)).toBe(0);
  });
});

describe("messageRefusArene", () => {
  it("traduit les refus propres à l'arène, puis ceux des défis", () => {
    expect(messageRefusArene("DEJA_EN_FILE", "?")).toMatch(/déjà dans la file/);
    expect(messageRefusArene("LIMITE_DEFIS", "?")).toMatch(/défis en attente/);
    expect(messageRefusArene("autre chose", "Par défaut")).toBe("Par défaut");
  });
});
