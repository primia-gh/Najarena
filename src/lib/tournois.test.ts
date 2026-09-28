import { describe, expect, it } from "vitest";
import { formaterDate } from "./tournois";

describe("formaterDate", () => {
  it("affiche l'heure de Paris, quel que soit le fuseau du serveur", () => {
    // 19:00 UTC le 27/09 = 21:00 à Paris (heure d'été).
    expect(formaterDate("2026-09-27T19:00:00Z")).toBe("27/09 21:00");
  });

  it("heure d'hiver : 20:00 UTC = 21:00 à Paris", () => {
    expect(formaterDate("2026-12-10T20:00:00Z")).toBe("10/12 21:00");
  });
});
