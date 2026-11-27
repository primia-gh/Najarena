import { describe, expect, it } from "vitest";
import { bilanChampion } from "./champion-tableau";

const matchs = [
  { id: "q1", tour: 1 },
  { id: "q2", tour: 1 },
  { id: "d1", tour: 2 },
  { id: "f", tour: 3 },
];

describe("bilanChampion", () => {
  it("compte les victoires lues chez Riot et la finale vérifiée", () => {
    const v = new Map([
      ["q1", { gagnant_id: "a", niveau: "historique" }],
      ["d1", { gagnant_id: "a", niveau: "code_tournoi" }],
      ["f", { gagnant_id: "a", niveau: "historique" }],
    ]);
    expect(bilanChampion(matchs, v, "a")).toEqual({ victoiresVerifiees: 3, finaleVerifiee: true });
  });

  it("ignore les verdicts manuels, même en finale", () => {
    const v = new Map([
      ["q1", { gagnant_id: "a", niveau: "historique" }],
      ["d1", { gagnant_id: "a", niveau: "manuel" }],
      ["f", { gagnant_id: "a", niveau: "manuel" }],
    ]);
    expect(bilanChampion(matchs, v, "a")).toEqual({ victoiresVerifiees: 1, finaleVerifiee: false });
  });

  it("ne compte pas les victoires des autres joueurs", () => {
    const v = new Map([["q2", { gagnant_id: "b", niveau: "historique" }]]);
    expect(bilanChampion(matchs, v, "a")).toEqual({ victoiresVerifiees: 0, finaleVerifiee: false });
  });

  it("tableau vide : rien de vérifié", () => {
    expect(bilanChampion([], new Map(), "a")).toEqual({ victoiresVerifiees: 0, finaleVerifiee: false });
  });
});
