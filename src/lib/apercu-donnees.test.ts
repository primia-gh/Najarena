import { describe, expect, it } from "vitest";
import { bilanPreuve, construireRepartition, SEUIL_REPARTITION, semainesActivite } from "./apercu-donnees";

describe("construireRepartition", () => {
  it("ne montre rien sous le seuil", () => {
    expect(construireRepartition([1500, 1600])).toBeNull();
  });

  it("compte chaque joueur une fois, dans la bonne classe", () => {
    const ratings = [1499, 1500, 1549.9, 1550, 1900, 2400, 1000, 1700, 1701, 1800];
    expect(ratings.length).toBeGreaterThanOrEqual(SEUIL_REPARTITION);
    const r = construireRepartition(ratings)!;
    expect(r.total).toBe(ratings.length);
    expect(r.classes.reduce((a, b) => a + b, 0)).toBe(ratings.length);
    const classe = (v: number) => r.classes[Math.floor((v - r.debut) / r.pas)];
    expect(classe(1500)).toBe(2); // 1500 et 1549.9
    expect(r.debut).toBeLessThanOrEqual(1000);
    expect(r.debut + r.classes.length * r.pas).toBeGreaterThan(2400);
  });
});

describe("semainesActivite", () => {
  const maintenant = new Date("2026-11-27T12:00:00Z").getTime();
  it("range les matchs par semaine glissante, la semaine en cours en dernier", () => {
    const s = semainesActivite(
      ["2026-11-27T10:00:00Z", "2026-11-25T10:00:00Z", "2026-11-18T10:00:00Z", "2026-08-01T10:00:00Z", "2026-11-28T10:00:00Z"],
      maintenant,
    );
    expect(s).toHaveLength(12);
    expect(s[11]).toBe(2);
    expect(s[10]).toBe(1);
    expect(s.reduce((a, b) => a + b, 0)).toBe(3); // trop ancien et futur ignorés
  });
});

describe("bilanPreuve", () => {
  it("sépare lus chez Riot et manuels, forme du plus ancien au plus récent", () => {
    const h = [
      { niveau: "historique", estGagnant: true, creeLe: "2026-11-03" },
      { niveau: "manuel", estGagnant: true, creeLe: "2026-11-02" },
      { niveau: "code_tournoi", estGagnant: false, creeLe: "2026-11-01" },
    ];
    const b = bilanPreuve(h);
    expect(b.lusChezRiot).toBe(2);
    expect(b.manuels).toBe(1);
    expect(b.forme).toEqual(["D", "M", "V"]);
  });

  it("garde les 10 derniers", () => {
    const h = Array.from({ length: 14 }, (_, i) => ({
      niveau: "historique",
      estGagnant: i % 2 === 0,
      creeLe: new Date(2026, 9, i + 1).toISOString(),
    }));
    expect(bilanPreuve(h).forme).toHaveLength(10);
  });
});
