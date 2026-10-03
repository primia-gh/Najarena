import { describe, expect, it } from "vitest";
import { doitSynchroniserClash, echeancesDepuisClash, libelleClash } from "./echeances";

describe("échéances", () => {
  it("lit le calendrier Clash quatre fois par jour", () => {
    expect(doitSynchroniserClash(new Date("2026-10-03T06:02:00Z"))).toBe(true);
    expect(doitSynchroniserClash(new Date("2026-10-03T06:07:00Z"))).toBe(false);
    expect(doitSynchroniserClash(new Date("2026-10-03T07:02:00Z"))).toBe(false);
  });

  it("nomme un Clash à partir des clés Riot", () => {
    expect(libelleClash("bilgewater", "day_4")).toBe("Clash Bilgewater — jour 4");
    expect(libelleClash("shurima_cup", "")).toBe("Clash Shurima Cup");
  });

  it("ne garde que les phases à venir et non annulées", () => {
    const maintenant = new Date("2026-10-03T12:00:00Z");
    const lignes = echeancesDepuisClash(
      "EUW",
      [
        {
          id: 7,
          themeId: 1,
          nameKey: "bilgewater",
          nameKeySecondary: "day_1",
          schedule: [
            { id: 1, registrationTime: 0, startTime: Date.parse("2026-10-10T17:00:00Z"), cancelled: false },
            { id: 2, registrationTime: 0, startTime: Date.parse("2026-10-11T17:00:00Z"), cancelled: true },
            { id: 3, registrationTime: 0, startTime: Date.parse("2026-09-01T17:00:00Z"), cancelled: false },
          ],
        },
      ],
      maintenant,
    );
    expect(lignes).toEqual([
      {
        type: "clash",
        nom: "Clash Bilgewater — jour 1",
        region: "EUW",
        debut_le: "2026-10-10T17:00:00.000Z",
        source: "riot",
        cle_externe: "clash-EUW-7-1",
      },
    ]);
  });
});
