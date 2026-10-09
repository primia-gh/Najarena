import { describe, expect, it } from "vitest";
import { libelleMatchsCommuns, messageRefusRecommandation } from "./recommandations";

describe("libelleMatchsCommuns", () => {
  it("dit ce qui fonde la recommandation", () => {
    expect(libelleMatchsCommuns(0, 1)).toBe("1 match vérifié l'un contre l'autre");
    expect(libelleMatchsCommuns(0, 3)).toBe("3 matchs vérifiés l'un contre l'autre");
    expect(libelleMatchsCommuns(4, 0)).toBe("4 matchs vérifiés ensemble");
    expect(libelleMatchsCommuns(1, 2)).toBe("1 match vérifié ensemble · 2 contre");
  });
});

describe("messageRefusRecommandation", () => {
  it("traduit les refus de la base", () => {
    expect(messageRefusRecommandation('ERROR: PAS_JOUE_ENSEMBLE')).toContain("lue chez Riot");
    expect(messageRefusRecommandation("autre")).toContain("Impossible");
  });
});
