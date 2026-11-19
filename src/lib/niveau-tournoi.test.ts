import { describe, expect, it } from "vitest";
import { CHOIX_MAXIMUM, CHOIX_MINIMUM, libelleNiveau, lireNiveau, messageNiveau, ratingDansNiveau } from "./niveau-tournoi";

describe("libelleNiveau", () => {
  it("nomme la fourchette par ses paliers", () => {
    expect(libelleNiveau(1450, null)).toBe("Or et plus");
    expect(libelleNiveau(null, 1450)).toBe("jusqu'à Argent");
    expect(libelleNiveau(1300, 1600)).toBe("Argent à Or");
    expect(libelleNiveau(1450, 1600)).toBe("Or");
    expect(libelleNiveau(null, null)).toBeNull();
  });
});

describe("ratingDansNiveau", () => {
  it("borne basse incluse, borne haute exclue, 1500 sans partie", () => {
    expect(ratingDansNiveau(1450, 1450, 1600)).toBe(true);
    expect(ratingDansNiveau(1600, 1450, 1600)).toBe(false);
    expect(ratingDansNiveau(null, 1450, 1600)).toBe(true);
    expect(ratingDansNiveau(null, 1600, null)).toBe(false);
    expect(ratingDansNiveau(2100, null, null)).toBe(true);
  });
});

describe("lireNiveau", () => {
  it("accepte les seuils proposés, vides = ouvert à tous", () => {
    expect(lireNiveau("1300", "1600", "1v1")).toEqual({ ok: true, min: 1300, max: 1600 });
    expect(lireNiveau("", "", "5v5")).toEqual({ ok: true, min: null, max: null });
  });

  it("refuse une valeur inventée, un minimum trop haut, un niveau en 5v5", () => {
    expect(lireNiveau("1400", "", "1v1").ok).toBe(false);
    expect(lireNiveau("1600", "1450", "1v1").ok).toBe(false);
    expect(lireNiveau("1450", "", "5v5").ok).toBe(false);
  });

  it("propose cinq minimums et cinq maximums", () => {
    expect(CHOIX_MINIMUM).toHaveLength(5);
    expect(CHOIX_MAXIMUM[0]).toEqual({ valeur: 1300, libelle: "jusqu'à Bronze" });
  });
});

describe("messageNiveau", () => {
  it("traduit les codes de la base", () => {
    expect(messageNiveau("NIVEAU_HORS_TOURNOI")).toMatch(/niveau de ce tournoi/);
    expect(messageNiveau("autre chose")).toBeNull();
  });
});
