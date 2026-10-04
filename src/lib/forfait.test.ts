import { describe, expect, it } from "vitest";
import { forfaitAAppliquer, limiteForfait } from "./forfait";

const maintenant = new Date("2026-10-01T19:30:00Z");

describe("forfait automatique", () => {
  it("déclare forfait le joueur absent 15 minutes après que son adversaire s'est dit prêt", () => {
    expect(
      forfaitAAppliquer(
        [
          { profileId: "a", pretLe: "2026-10-01T19:15:00Z" },
          { profileId: "b", pretLe: null },
        ],
        maintenant,
      ),
    ).toEqual({ absentId: "b", presentId: "a" });
  });

  it("laisse encore du temps avant 15 minutes", () => {
    expect(
      forfaitAAppliquer(
        [
          { profileId: "a", pretLe: "2026-10-01T19:15:01Z" },
          { profileId: "b", pretLe: null },
        ],
        maintenant,
      ),
    ).toBeNull();
  });

  it("ne fait rien si les deux sont prêts, ou si aucun ne l'est", () => {
    expect(
      forfaitAAppliquer(
        [
          { profileId: "a", pretLe: "2026-10-01T19:00:00Z" },
          { profileId: "b", pretLe: "2026-10-01T19:10:00Z" },
        ],
        maintenant,
      ),
    ).toBeNull();
    expect(
      forfaitAAppliquer(
        [
          { profileId: "a", pretLe: null },
          { profileId: "b", pretLe: null },
        ],
        maintenant,
      ),
    ).toBeNull();
  });

  it("ne fait rien tant que l'adversaire n'est pas connu", () => {
    expect(forfaitAAppliquer([{ profileId: "a", pretLe: "2026-10-01T18:00:00Z" }], maintenant)).toBeNull();
  });

  it("donne l'heure limite : 15 minutes après l'adversaire", () => {
    expect(limiteForfait("2026-10-01T19:15:00Z").toISOString()).toBe("2026-10-01T19:30:00.000Z");
  });
});
