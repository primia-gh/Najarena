import { describe, expect, it } from "vitest";
import { typographie } from "./typographie";

describe("typographie", () => {
  it("espace insécable avant : ; ? ! et dans les guillemets", () => {
    expect(typographie("Terminer ce suivi ? Oui : « Coach vérifié » ; fin !")).toBe(
      "Terminer ce suivi ? Oui : « Coach vérifié » ; fin !",
    );
  });
});
