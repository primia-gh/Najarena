import { describe, expect, it } from "vitest";
import { ordonnerParRating } from "./bracket-construction";

describe("ordonnerParRating", () => {
  it("meilleur rating en tête de série, joueurs sans rating à la fin", () => {
    const ordre = ordonnerParRating([
      { profileId: "bronze", rating: 1280 },
      { profileId: "nouveau", rating: null },
      { profileId: "diamant", rating: 1790 },
      { profileId: "or", rating: 1500 },
    ]);
    expect(ordre).toEqual(["diamant", "or", "bronze", "nouveau"]);
  });

  it("à égalité, l'ordre vient du tirage au sort (plus de placement figé)", () => {
    const joueurs = [
      { profileId: "a", rating: null },
      { profileId: "b", rating: null },
      { profileId: "c", rating: null },
    ];
    const ordres = new Set(
      [0, 0.34, 0.67, 0.99].map((x) => ordonnerParRating(joueurs, () => x).join(",")),
    );
    expect(ordres.size).toBeGreaterThan(1);
  });

  it("n'oublie ni ne duplique aucun joueur", () => {
    const joueurs = Array.from({ length: 16 }, (_, i) => ({
      profileId: `j${i}`,
      rating: i % 3 === 0 ? null : 1300 + i * 25,
    }));
    const ordre = ordonnerParRating(joueurs);
    expect([...ordre].sort()).toEqual(joueurs.map((j) => j.profileId).sort());
  });
});
