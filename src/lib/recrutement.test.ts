import { describe, expect, it } from "vitest";
import { libelleNiveauRecrutement, libellePostes, messageRecrutement, postesValides } from "./recrutement";

describe("postesValides", () => {
  it("garde les postes connus, sans doublon, dans l'ordre du jeu", () => {
    expect(postesValides(["support", "coach", "top", "support"])).toEqual(["top", "support"]);
    expect(postesValides([])).toEqual([]);
  });
});

describe("libellés", () => {
  it("postes et niveau", () => {
    expect(libellePostes(["jungle", "support"])).toBe("Jungle, Support");
    expect(libelleNiveauRecrutement(1450)).toBe("Or et plus");
    expect(libelleNiveauRecrutement(null)).toBeNull();
  });
});

describe("messageRecrutement", () => {
  it("traduit un code de la base, sinon le message par défaut", () => {
    expect(messageRecrutement("NIVEAU_INSUFFISANT", "x")).toMatch(/sous le niveau/);
    expect(messageRecrutement("erreur réseau", "Par défaut")).toBe("Par défaut");
  });
});
