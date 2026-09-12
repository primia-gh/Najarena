import { describe, expect, it } from "vitest";
import { ordreDesSeeds, calculerByesEnCascade } from "./bracket";

describe("ordreDesSeeds", () => {
  it("capacité 1 : un seul seed", () => {
    expect(ordreDesSeeds(1)).toEqual([1]);
  });

  it("capacité 4 : seed1 vs seed4, seed2 vs seed3 (exemple de référence du commentaire)", () => {
    expect(ordreDesSeeds(4)).toEqual([1, 4, 2, 3]);
  });

  it.each([4, 8, 16, 32, 64])(
    "capacité %i : contient chaque seed de 1 à la capacité exactement une fois",
    (capacite) => {
      const ordre = ordreDesSeeds(capacite);
      expect(ordre).toHaveLength(capacite);
      expect(new Set(ordre).size).toBe(capacite);
      expect([...ordre].sort((a, b) => a - b)).toEqual(
        Array.from({ length: capacite }, (_, i) => i + 1),
      );
    },
  );

  it.each([4, 8, 16, 32, 64])(
    "capacité %i : chaque paire de premier tour se somme à capacité+1 (chaque match oppose le meilleur et le pire seed restants)",
    (capacite) => {
      const ordre = ordreDesSeeds(capacite);
      for (let i = 0; i < capacite; i += 2) {
        expect(ordre[i] + ordre[i + 1]).toBe(capacite + 1);
      }
    },
  );

  it("capacité 8 avec 5 joueurs confirmés : aucun match du tour 1 ne se retrouve à 0 participant (bug #1 corrigé le 2026-09-11)", () => {
    // Repro exacte de la régression : moins de joueurs confirmés que de
    // places, un ordre naïf (seed = position) pouvait placer deux seeds
    // absents côte à côte dans le même match.
    const capacite = 8;
    const nbJoueurs = 5;
    const ordre = ordreDesSeeds(capacite);

    for (let position = 0; position < capacite / 2; position++) {
      const seedA = ordre[position * 2];
      const seedB = ordre[position * 2 + 1];
      const participants = [seedA, seedB].filter((s) => s <= nbJoueurs).length;
      expect(participants).toBeGreaterThan(0);
    }
  });
});

describe("calculerByesEnCascade", () => {
  it("capacité 4, 4 joueurs : aucun bye, tout se joue en vrais matchs", () => {
    expect(calculerByesEnCascade(4, 4)).toEqual([]);
  });

  it("capacité 4, 3 joueurs : un seul bye au tour 1, le tour 2 (finale) reste un vrai match en attente", () => {
    // ordre = [1,4,2,3] : seed4 absent → seed1 a un bye. seed2 vs seed3
    // est un vrai match, jamais résolu par cette fonction.
    expect(calculerByesEnCascade(4, 3)).toEqual([{ tour: 1, position: 1, gagnantSeed: 1 }]);
  });

  it("capacité 2, 2 joueurs : un seul tour, jamais de bye à calculer", () => {
    expect(calculerByesEnCascade(2, 2)).toEqual([]);
  });

  it("capacité 8, 2 joueurs : cascade sur deux tours jusqu'à la finale (bug #3 du 2026-09-12 — match vide bloquant à tort)", () => {
    // Avant le correctif, le tour 2 restait bloqué indéfiniment : les deux
    // matchs vides du tour 1 (0 participant) étaient traités comme "non
    // décidés" et empêchaient les byes du tour 2 de se résoudre, alors
    // qu'un match vide ne peut structurellement plus jamais produire de
    // participant. Les deux joueurs doivent atteindre la finale (tour 3)
    // sans intervention manuelle.
    const byes = calculerByesEnCascade(8, 2);

    expect(byes).toContainEqual({ tour: 1, position: 1, gagnantSeed: 1 });
    expect(byes).toContainEqual({ tour: 1, position: 3, gagnantSeed: 2 });
    expect(byes).toContainEqual({ tour: 2, position: 1, gagnantSeed: 1 });
    expect(byes).toContainEqual({ tour: 2, position: 2, gagnantSeed: 2 });
    expect(byes).toHaveLength(4);
  });

  it("capacité 8, 5 joueurs : seed1 avance par bye jusqu'à attendre en finale un vrai match pas encore joué (bug #2 du 2026-09-11)", () => {
    // seed4 vs seed5 (tour 1) et seed2 vs seed3 (tour 2, après leurs byes
    // respectifs) sont de vrais matchs : jamais résolus ici. Seul seed1
    // avance par bye jusqu'en finale, où il attend — la finale n'apparaît
    // PAS dans la liste malgré son 1 seul participant à ce stade, parce
    // qu'elle dépend encore d'un vrai match non joué (piège #1).
    const byes = calculerByesEnCascade(8, 5);

    expect(byes).toContainEqual({ tour: 1, position: 1, gagnantSeed: 1 });
    expect(byes).toContainEqual({ tour: 2, position: 1, gagnantSeed: 1 });
    expect(byes.some((b) => b.tour === 3)).toBe(false);
    expect(byes.some((b) => b.tour === 1 && b.position === 2)).toBe(false); // seed4 vs seed5
    expect(byes.some((b) => b.tour === 2 && b.position === 2)).toBe(false); // seed2 vs seed3
  });

  it("ne produit jamais deux fois la même position (chaque match n'est résolu qu'une fois)", () => {
    for (const [capacite, nbJoueurs] of [[8, 2], [8, 5], [16, 3], [32, 7]] as const) {
      const byes = calculerByesEnCascade(capacite, nbJoueurs);
      const cles = byes.map((b) => `${b.tour}-${b.position}`);
      expect(new Set(cles).size).toBe(cles.length);
    }
  });
});
