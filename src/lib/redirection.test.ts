import { describe, expect, it } from "vitest";
import { destinationInterne } from "./redirection";

describe("destinationInterne", () => {
  it("accepte un chemin du site", () => {
    expect(destinationInterne("/nouveau-mot-de-passe")).toBe("/nouveau-mot-de-passe");
    expect(destinationInterne("/lol/tournois?statut=ouvert")).toBe("/lol/tournois?statut=ouvert");
  });

  it("refuse tout ce qui mènerait ailleurs", () => {
    for (const piege of ["@exemple.com", ".exemple.com", "//exemple.com", "/\\exemple.com", "https://exemple.com", "/@exemple.com", "exemple.com"]) {
      expect(destinationInterne(piege)).toBe("/moi");
    }
  });

  it("sans destination : le tableau de bord", () => {
    expect(destinationInterne(null)).toBe("/moi");
  });
});
