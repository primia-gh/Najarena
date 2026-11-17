import { describe, expect, it } from "vitest";
import { typographie } from "./typographie";

describe("typographie", () => {
  it("espace insécable avant : ; ? ! et dans les guillemets", () => {
    expect(typographie("Terminer ce suivi ? Oui : « Coach vérifié » ; fin !")).toBe(
      "Terminer ce suivi ? Oui : « Coach vérifié » ; fin !",
    );
  });

  it("espace insécable entre un nombre et le mot qui suit", () => {
    expect(typographie("300 caractères au plus, 24 heures, 1750 ou plus")).toBe(
      "300 caractères au plus, 24 heures, 1750 ou plus".replace("1750 ou", "1750 ou"),
    );
    expect(typographie("Saison 2 : 12 / 15")).toBe("Saison 2 : 12 / 15");
  });
});
