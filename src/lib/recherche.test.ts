import { describe, expect, it } from "vitest";
import { filtresActifs, formaterProgression, lireFiltres, resumeActivite, resumeFiabilite } from "./recherche";

const paliers = [
  { nom: "Or", ratingMin: 1450 },
  { nom: "Diamant", ratingMin: 1750 },
];

describe("filtres de la recherche", () => {
  it("lit les filtres de l'adresse et ignore les valeurs inconnues", () => {
    const f = lireFiltres(
      { role: "mid", region: "EUW", palier_min: "Or", classes: "1", actif: "30", progression: "1", fiable: "1", sans_equipe: "1", tri: "progression" },
      paliers,
    );
    expect(f).toEqual({
      role: "mid",
      region: "EUW",
      ratingMin: 1450,
      classesSeulement: true,
      disponible: false,
      sansEquipe: true,
      actifJours: 30,
      enProgression: true,
      fiable: true,
      tri: "progression",
    });
    const vide = lireFiltres({ role: "coach", region: "MARS", actif: "12", tri: "hasard", rating_min: "abc" }, paliers);
    expect(vide).toMatchObject({ role: null, region: null, ratingMin: null, actifJours: null, tri: "rating" });
    expect(filtresActifs(vide)).toBe(false);
  });

  it("garde le plus exigeant d'un palier et d'un rating précis", () => {
    expect(lireFiltres({ palier_min: "Or", rating_min: "1700" }, paliers).ratingMin).toBe(1700);
    expect(lireFiltres({ palier_min: "Diamant", rating_min: "1700" }, paliers).ratingMin).toBe(1750);
  });
});

describe("mise en mots", () => {
  it("écrit la progression avec son signe", () => {
    expect(formaterProgression(42.4)).toBe("+42");
    expect(formaterProgression(-18)).toBe("−18");
    expect(formaterProgression(0.2)).toBe("0");
    expect(formaterProgression(null)).toBeNull();
  });

  it("résume l'activité", () => {
    const maintenant = Date.parse("2026-11-18T12:00:00Z");
    expect(resumeActivite(0, null, maintenant)).toBe("Aucune partie vérifiée en 90 jours");
    expect(resumeActivite(1, "2026-11-18T08:00:00Z", maintenant)).toBe("1 partie vérifiée · aujourd'hui");
    expect(resumeActivite(12, "2026-11-15T10:00:00Z", maintenant)).toBe("12 parties vérifiées · il y a 3 j");
  });

  it("ne dit rien de la fiabilité sous 3 matchs, comme le CV", () => {
    expect(resumeFiabilite({ matchs_joues: 2, forfaits: 0, tournois_1v1: 0, checkins: 0 })).toBeNull();
    expect(resumeFiabilite({ matchs_joues: 8, forfaits: 0, tournois_1v1: 2, checkins: 2 })).toBe("aucun forfait sur 8 matchs");
    expect(resumeFiabilite({ matchs_joues: 8, forfaits: 1, tournois_1v1: 5, checkins: 4 })).toBe("1 forfait sur 8 matchs · check-in 80 %");
  });
});
