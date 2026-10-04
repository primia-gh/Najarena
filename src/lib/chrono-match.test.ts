import { describe, expect, it } from "vitest";
import { debutChrono, formaterChrono } from "./chrono-match";

describe("debutChrono", () => {
  it("part quand le second joueur se déclare prêt", () => {
    expect(debutChrono({ moi: "2026-10-04T20:02:00Z", adversaire: "2026-10-04T20:05:00Z" })).toBe(
      "2026-10-04T20:05:00Z",
    );
    expect(debutChrono({ moi: "2026-10-04T20:07:00Z", adversaire: "2026-10-04T20:05:00Z" })).toBe(
      "2026-10-04T20:07:00Z",
    );
  });

  it("ne part pas tant qu'un des deux n'est pas prêt", () => {
    expect(debutChrono({ moi: "2026-10-04T20:02:00Z", adversaire: null })).toBeNull();
    expect(debutChrono({ moi: null, adversaire: null })).toBeNull();
  });
});

describe("formaterChrono", () => {
  const debut = "2026-10-04T20:00:00Z";
  const t = (secondes: number) => new Date(debut).getTime() + secondes * 1000;

  it("minutes et secondes, puis heures", () => {
    expect(formaterChrono(debut, t(0))).toBe("0:00");
    expect(formaterChrono(debut, t(65))).toBe("1:05");
    expect(formaterChrono(debut, t(25 * 60 + 9))).toBe("25:09");
    expect(formaterChrono(debut, t(3600 + 2 * 60 + 5))).toBe("1:02:05");
  });

  it("jamais négatif (horloge du visiteur en avance ou en retard)", () => {
    expect(formaterChrono(debut, t(-30))).toBe("0:00");
  });
});
