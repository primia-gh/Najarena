import { describe, expect, it } from "vitest";
import { avecMessage, destinationInterne } from "./redirection";

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

  it("retire les messages de la destination (le site y renverrait lui-même)", () => {
    expect(destinationInterne("/joueur/x?coach=Texte%20pi%C3%A9g%C3%A9&onglet=lol#coach")).toBe("/joueur/x?onglet=lol#coach");
    expect(destinationInterne("/moi?message=Faux")).toBe("/moi");
  });

  it("jamais un autre site, même par un chemin à points ou encodé", () => {
    for (const piege of ["/.//evil.example?message=x", "/..//evil.example?message=x", "/%2e//evil.example?message=x", "/.\\/evil.example?message=x", "/a/..//evil.example?message=x", "/.//evil.example"]) {
      const destination = destinationInterne(piege);
      expect(destination.startsWith("//")).toBe(false);
      expect(destination).toBe("/moi");
    }
  });

  it("sans destination : le tableau de bord", () => {
    expect(destinationInterne(null)).toBe("/moi");
  });
});

describe("avecMessage", () => {
  it("ajoute le message à une page du site, en gardant sa partie après #", () => {
    expect(avecMessage("/defi/abc123", "Compte vérifié.")).toBe("/defi/abc123?message=Compte+v%C3%A9rifi%C3%A9.");
    expect(avecMessage("/lol/tournois/x?onglet=1#ton-match", "ok")).toBe("/lol/tournois/x?onglet=1&message=ok#ton-match");
  });

  it("remplace un message déjà présent au lieu d'en garder deux", () => {
    expect(avecMessage("/defi/abc?message=ancien", "nouveau")).toBe("/defi/abc?message=nouveau");
  });

  it("ne mène jamais hors du site", () => {
    for (const piege of ["//exemple.com/x", "https://exemple.com", "/\\exemple.com", "/a/../../x", "/%2e%2e/x", "@exemple.com", ""]) {
      const resultat = avecMessage(piege, "m");
      expect(resultat.startsWith("/")).toBe(true);
      expect(resultat.startsWith("//")).toBe(false);
      expect(resultat).not.toContain("exemple.com");
    }
  });
});
