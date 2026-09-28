import { describe, expect, it } from "vitest";
import { estPseudoAutomatique, prochainChangementPseudo, PSEUDO_REGEX } from "./pseudo";

describe("pseudo", () => {
  it("reconnaît le pseudo donné d'office à un compte Discord", () => {
    expect(estPseudoAutomatique("Joueur-1a2b3c4d")).toBe(true);
    expect(estPseudoAutomatique("joueur-1A2B3C4D")).toBe(true);
    expect(estPseudoAutomatique("Joueur-Pro")).toBe(false);
    expect(estPseudoAutomatique("Joueur-1a2b3c4d5")).toBe(false);
  });

  it("applique les règles de l'inscription", () => {
    expect(PSEUDO_REGEX.test("Eve Pro")).toBe(true);
    expect(PSEUDO_REGEX.test("Ev")).toBe(false);
    expect(PSEUDO_REGEX.test("Élodie")).toBe(false);
    expect(PSEUDO_REGEX.test("a".repeat(21))).toBe(false);
  });

  it("laisse changer de pseudo 30 jours après le dernier changement", () => {
    const maintenant = new Date("2026-09-28T12:00:00Z");
    expect(prochainChangementPseudo(null, maintenant)).toBeNull();
    expect(prochainChangementPseudo("2026-09-20T12:00:00Z", maintenant)?.toISOString()).toBe(
      "2026-10-20T12:00:00.000Z",
    );
    expect(prochainChangementPseudo("2026-08-01T12:00:00Z", maintenant)).toBeNull();
  });
});
