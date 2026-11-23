import { describe, expect, it } from "vitest";
import { adresseCanonique, bilanFaceAFace, type MatchFaceAFace } from "./face-a-face";

function match(
  id: string,
  gagnant: string | null,
  niveau: MatchFaceAFace["niveau"] = "historique",
  forfait = false,
  niveauCompteMin: number | null = null,
): MatchFaceAFace {
  return { matchId: id, joueLe: "2026-11-01T20:00:00Z", tournoiSlug: "t", tournoiNom: "T", nature: "tournoi", gagnantId: gagnant, niveau, forfait, niveauCompteMin };
}

describe("bilanFaceAFace", () => {
  it("ne compte que les matchs lus chez Riot et joués", () => {
    const b = bilanFaceAFace(
      [match("1", "a"), match("2", "b", "manuel"), match("3", "a", "manuel", true), match("4", "b", "code_tournoi")],
      "a",
      "b",
    );
    expect(b).toMatchObject({ victoiresA: 1, victoiresB: 1, verifies: 2, manuels: 1, forfaits: 1 });
    expect(b.dernier?.matchId).toBe("1");
  });

  it("un match avec un compte Riot sous le niveau 30 est listé, jamais compté (23/11/2026)", () => {
    const b = bilanFaceAFace(
      [match("1", "a", "historique", false, 12), match("2", "a", "historique", false, 30), match("3", "b", "historique", false, null)],
      "a",
      "b",
    );
    expect(b).toMatchObject({ victoiresA: 1, victoiresB: 1, verifies: 2, horsClassement: 1 });
    expect(b.dernier?.matchId).toBe("2");
  });

  it("série en cours du dernier vainqueur", () => {
    const b = bilanFaceAFace([match("1", "b"), match("2", "b"), match("3", "a"), match("4", "b")], "a", "b");
    expect(b.serie).toEqual({ gagnantId: "b", longueur: 2 });
  });

  it("aucun match compté : pas de dernier ni de série", () => {
    const b = bilanFaceAFace([match("1", "a", "manuel")], "a", "b");
    expect(b.verifies).toBe(0);
    expect(b.dernier).toBeNull();
    expect(b.serie).toBeNull();
  });
});

describe("adresseCanonique", () => {
  it("met les deux adresses dans l'ordre alphabétique", () => {
    expect(adresseCanonique("zed", "ahri")).toBe("/lol/face-a-face/ahri/zed");
    expect(adresseCanonique("ahri", "zed")).toBe("/lol/face-a-face/ahri/zed");
  });
});
