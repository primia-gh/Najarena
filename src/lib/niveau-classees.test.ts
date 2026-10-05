import { describe, expect, it } from "vitest";
import { positionsNiveau } from "./niveau-classees";

describe("positionsNiveau", () => {
  it("donne la part des autres joueurs dépassés, égalités pour moitié, et l'inverse pour les morts", () => {
    const positions = positionsNiveau([
      { indicateur: "morts_10min", joueurs: 20, en_dessous: 4, egaux: 0 },
      { indicateur: "sbires_min", joueurs: 10, en_dessous: 5, egaux: 1 },
      { indicateur: "vision_min", joueurs: 9, en_dessous: 8, egaux: 0 },
      { indicateur: "inconnu", joueurs: 30, en_dessous: 3, egaux: 0 },
    ]);
    expect(positions).toEqual([
      { indicateur: "sbires_min", mieuxQue: 0.55, joueurs: 10 },
      { indicateur: "morts_10min", mieuxQue: 0.8, joueurs: 20 },
    ]);
  });
});
