import { describe, expect, it } from "vitest";
import { carteDesMorts, phaseDe, versTonCote, zoneDe } from "./carte-morts";

describe("zones de la carte (vue du côté du joueur)", () => {
  it("bases, voies, rivière, jungles", () => {
    expect(zoneDe(1000, 1000)).toBe("base");
    expect(zoneDe(14000, 14000)).toBe("base_adverse");
    expect(zoneDe(1000, 8000)).toBe("voie_haut");
    expect(zoneDe(8000, 14000)).toBe("voie_haut");
    expect(zoneDe(8000, 1000)).toBe("voie_bas");
    expect(zoneDe(14000, 6000)).toBe("voie_bas");
    expect(zoneDe(7400, 7400)).toBe("voie_milieu");
    expect(zoneDe(4000, 11000)).toBe("riviere");
    expect(zoneDe(4000, 8000)).toBe("jungle");
    expect(zoneDe(9500, 7000)).toBe("jungle_adverse");
  });

  it("une partie côté rouge est retournée : sa base est en bas à gauche", () => {
    expect(versTonCote(14000, 14000, 200)).toEqual({ x: 870, y: 870 });
    expect(versTonCote(14000, 14000, 100)).toEqual({ x: 14000, y: 14000 });
    expect(phaseDe(599)).toBe("0-10");
    expect(phaseDe(600)).toBe("10-20");
    expect(phaseDe(1799)).toBe("20-30");
    expect(phaseDe(2400)).toBe("30+");
  });
});

describe("carteDesMorts", () => {
  it("répartit les morts par zone et par moment, de son côté", () => {
    const carte = carteDesMorts([
      // Côté bleu : 6 morts dans la jungle adverse entre 10 et 20 minutes.
      { equipe: 100, gagne: false, morts_secondes: [700, 800, 900, 1000, 1100, 1150], morts_x: Array(6).fill(9500), morts_y: Array(6).fill(7000) },
      // Côté rouge : 4 morts au même endroit vu de son côté (coordonnées retournées), avant 10 minutes.
      { equipe: 200, gagne: true, morts_secondes: [200, 300, 400, 500], morts_x: Array(4).fill(14870 - 9500), morts_y: Array(4).fill(14870 - 7000) },
      { equipe: 100, gagne: true, morts_secondes: null, morts_x: null, morts_y: null },
    ]);
    expect(carte?.morts).toHaveLength(10);
    expect(carte?.parties).toBe(2);
    expect(carte?.parZone[0]).toEqual({ cle: "jungle_adverse", nombre: 10, part: 1 });
    expect(carte?.parPhase.slice(0, 2)).toEqual([
      { cle: "10-20", nombre: 6, part: 0.6 },
      { cle: "0-10", nombre: 4, part: 0.4 },
    ]);
  });

  it("rien sous 10 morts placées", () => {
    expect(carteDesMorts([{ equipe: 100, gagne: true, morts_secondes: [100], morts_x: [1], morts_y: [1] }])).toBeNull();
  });
});
