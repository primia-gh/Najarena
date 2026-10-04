import { describe, expect, it } from "vitest";
import { messageModeration } from "./moderation";

describe("modération", () => {
  it("traduit les refus de modération de la base", () => {
    expect(messageModeration('new row violates... "PSEUDO_INTERDIT"')).toMatch(/pseudo n'est pas accepté/);
    expect(messageModeration("NOM_INTERDIT")).toMatch(/nom n'est pas accepté/);
    expect(messageModeration("MESSAGE_INTERDIT")).toMatch(/arnaque/);
  });

  it("laisse passer les autres erreurs", () => {
    expect(messageModeration("duplicate key")).toBeNull();
    expect(messageModeration(undefined)).toBeNull();
  });
});
