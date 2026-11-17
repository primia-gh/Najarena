import { describe, expect, it } from "vitest";
import { messageRefusAnalyse } from "./analyse-reglages";

describe("messageRefusAnalyse", () => {
  it("traduit les refus de la base", () => {
    expect(messageRefusAnalyse("ERROR: P0001: COMPTE_RIOT_NON_VERIFIE", "x")).toMatch(/compte Riot principal/);
    expect(messageRefusAnalyse("OFFRE_ELITE_REQUISE", "x")).toMatch(/offre Elite/);
    expect(messageRefusAnalyse("DISCORD_NON_LIE", "x")).toMatch(/Discord/);
    expect(messageRefusAnalyse("autre", "Par défaut")).toBe("Par défaut");
  });
});
