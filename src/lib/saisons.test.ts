import { describe, expect, it } from "vitest";
import { joursRestants, libelleJoursRestants, periodeSaison } from "./saisons";

describe("saisons", () => {
  it("compte les jours restants d'une saison", () => {
    const maintenant = new Date("2026-09-28T12:00:00Z");
    expect(joursRestants("2026-12-18T00:00:00Z", maintenant)).toBe(80);
    expect(joursRestants("2026-09-28T20:00:00Z", maintenant)).toBe(0);
    expect(joursRestants("2026-09-01T00:00:00Z", maintenant)).toBeNull();
    expect(libelleJoursRestants(80)).toBe("Encore 80 jours");
    expect(libelleJoursRestants(0)).toBe("Dernier jour");
    expect(libelleJoursRestants(null)).toBe("Terminée");
  });

  it("donne la période d'une saison à l'heure de Paris", () => {
    expect(periodeSaison("2026-09-18T00:00:00Z", "2026-12-18T00:00:00Z")).toBe("septembre 2026 – décembre 2026");
  });
});
