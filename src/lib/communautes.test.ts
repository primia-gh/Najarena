import { describe, expect, it } from "vitest";
import { classementInterne, couleurValide, lienDiscordValide, messageRefusCommunaute } from "./communautes";

describe("validations", () => {
  it("couleur hexadécimale à 6 chiffres", () => {
    expect(couleurValide("#ff6600")).toBe(true);
    expect(couleurValide("rouge")).toBe(false);
    expect(couleurValide("#fff")).toBe(false);
  });

  it("invitation Discord seulement", () => {
    expect(lienDiscordValide("https://discord.gg/najaville")).toBe(true);
    expect(lienDiscordValide("https://discord.com/invite/abc-12")).toBe(true);
    expect(lienDiscordValide("https://exemple.com/x")).toBe(false);
    expect(lienDiscordValide("http://discord.gg/abc")).toBe(false);
  });
});

describe("classementInterne", () => {
  it("classe les membres par rating officiel, compte les non-classés sans chiffre", () => {
    const membres = [
      { profileId: "a", pseudo: "Ana", slug: "ana" },
      { profileId: "b", pseudo: "Ben", slug: "ben" },
      { profileId: "c", pseudo: "Cyd", slug: "cyd" },
      { profileId: "d", pseudo: "Dan", slug: "dan" },
    ];
    const ratings = new Map([
      ["a", { rating: 1500, estClasse: true }],
      ["b", { rating: 1720, estClasse: true }],
      ["c", { rating: 1900, estClasse: false }],
    ]);
    const { classes, nonClasses } = classementInterne(membres, ratings);
    expect(classes.map((m) => m.pseudo)).toEqual(["Ben", "Ana"]);
    expect(nonClasses).toBe(2);
  });
});

describe("messageRefusCommunaute", () => {
  it("traduit les refus de la base", () => {
    expect(
      messageRefusCommunaute('duplicate key value violates unique constraint "communautes_slug_key"', "?"),
    ).toMatch(/adresse est déjà prise/);
    expect(messageRefusCommunaute("GESTION_RESERVEE", "?")).toMatch(/fondateur/);
    expect(messageRefusCommunaute("autre", "Par défaut")).toBe("Par défaut");
  });
});
