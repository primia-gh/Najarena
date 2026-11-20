import { describe, expect, it } from "vitest";
import { estMatchVide, estTableau, libelleTourDouble, recitDouble } from "./double-elim";

describe("libelleTourDouble", () => {
  it("nomme les colonnes d'un tableau de 8 (k = 3)", () => {
    expect(libelleTourDouble("gagnants", 1, 3)).toBe("Gagnants · tour 1");
    expect(libelleTourDouble("gagnants", 3, 3)).toBe("Finale des gagnants");
    expect(libelleTourDouble("perdants", 4, 3)).toBe("Perdants · tour 1");
    expect(libelleTourDouble("perdants", 7, 3)).toBe("Finale des perdants");
    expect(libelleTourDouble("finale", 8, 3)).toBe("Grande finale");
  });
});

describe("estMatchVide", () => {
  it("seulement un match clos sans joueur", () => {
    expect(estMatchVide({ statut: "termine", match_participants: [] })).toBe(true);
    expect(estMatchVide({ statut: "en_attente", match_participants: [] })).toBe(false);
    expect(estMatchVide({ statut: "termine", match_participants: [{}] })).toBe(false);
  });
});

describe("estTableau / recitDouble", () => {
  it("reconnaît les tableaux et raconte la finale", () => {
    expect(estTableau("perdants")).toBe(true);
    expect(estTableau(null)).toBe(false);
    expect(recitDouble("Coupe", "Ahri", "Zed", 6)[0]).toBe(
      "Ahri remporte Coupe en double élimination (6 joueurs), en grande finale contre Zed.",
    );
  });
});
