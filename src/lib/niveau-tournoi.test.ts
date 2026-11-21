import { describe, expect, it } from "vitest";
import {
  CHOIX_MAXIMUM,
  CHOIX_MINIMUM,
  libelleNiveau,
  lireNiveau,
  messageNiveau,
  palierDuRating,
  ratingDansNiveau,
  situationNiveau,
} from "./niveau-tournoi";

describe("libelleNiveau", () => {
  it("nomme la fourchette par ses paliers", () => {
    expect(libelleNiveau(1450, null)).toBe("Or et plus");
    expect(libelleNiveau(null, 1450)).toBe("Bronze à Argent");
    expect(libelleNiveau(null, 1300)).toBe("Bronze");
    expect(libelleNiveau(1300, 1600)).toBe("Argent à Or");
    expect(libelleNiveau(1450, 1600)).toBe("Or");
    expect(libelleNiveau(null, null)).toBeNull();
  });
});

describe("palierDuRating", () => {
  it("suit les seuils fixes", () => {
    expect(palierDuRating(1299)).toBe("Bronze");
    expect(palierDuRating(1300)).toBe("Argent");
    expect(palierDuRating(1500)).toBe("Or");
    expect(palierDuRating(2050)).toBe("Champion");
  });
});

describe("situationNiveau", () => {
  it("dit au joueur où il se situe et ce qui manque", () => {
    expect(situationNiveau(1380, 1450, null)).toBe(
      "Ton rating de la saison : 1\u202f380 (Argent). Ce tournoi est réservé aux joueurs de niveau Or et plus : il te manque 70 points.",
    );
    expect(situationNiveau(null, 1600, null)).toContain("Tu n'as pas encore joué cette saison : ton rating compte pour 1\u202f500 (Or).");
    expect(situationNiveau(1700, null, 1600)).toContain("réservé aux joueurs de niveau Bronze à Or : ton niveau le dépasse");
  });
});

describe("limite haute : meilleur rating de la saison", () => {
  it("un joueur redescendu n'entre pas sous un plafond qu'il a dépassé", () => {
    expect(ratingDansNiveau(1350, null, 1450, 1500)).toBe(false);
    expect(ratingDansNiveau(1380, null, 1450, 1420)).toBe(true);
    // Le plancher reste lu sur le rating actuel.
    expect(ratingDansNiveau(1350, 1300, null, 1500)).toBe(true);
  });

  it("le dit au joueur, avec son meilleur rating", () => {
    expect(situationNiveau(1350, null, 1450, 1500)).toContain(
      "Ton rating actuel convient, mais pour la limite haute, c'est ton meilleur rating de la saison en cours ou de la précédente qui compte : 1\u202f500 (Or), au-dessus.",
    );
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
    expect(messageNiveau("NIVEAU_HORS_TOURNOI")).toMatch(/pas celui de ce tournoi.*meilleur rating de la saison en cours ou de la précédente/);
    expect(messageNiveau("autre chose")).toBeNull();
  });
});
