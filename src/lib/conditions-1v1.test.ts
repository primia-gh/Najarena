import { describe, expect, it } from "vitest";
import { vainqueurClassique, type ChronologieRiot, type EvenementChronologie } from "./conditions-1v1";

const A = { participantId: 1, equipe: 100 };
const B = { participantId: 2, equipe: 200 };
const MINUTE = 60_000;

/** Chronologie d'une partie : sbires de A et B à chaque minute, évènements datés. */
function chronologie(sbiresA: number[], sbiresB: number[], evenements: EvenementChronologie[] = []): ChronologieRiot {
  return {
    info: {
      frames: sbiresA.map((cs, minute) => ({
        timestamp: minute * MINUTE,
        participantFrames: { "1": { minionsKilled: cs }, "2": { minionsKilled: sbiresB[minute] ?? 0 } },
        events: evenements.filter((e) => e.timestamp > (minute - 1) * MINUTE && e.timestamp <= minute * MINUTE),
      })),
    },
  };
}

describe("1v1 classique : premier sang, première tour ou 100 sbires", () => {
  it("premier sang : la victime perd, même tuée par une tour", () => {
    const c = chronologie([0, 8, 16, 24], [0, 7, 15, 22], [{ type: "CHAMPION_KILL", timestamp: 150_000, killerId: 0, victimId: 1 }]);
    expect(vainqueurClassique(c, A, B)).toEqual({ vainqueur: "B", condition: "premier_sang" });
  });

  it("première tour : son propriétaire perd", () => {
    const c = chronologie([0, 20, 40, 60, 80], [0, 18, 36, 50, 66], [
      { type: "BUILDING_KILL", timestamp: 230_000, buildingType: "TOWER_BUILDING", teamId: 200 },
    ]);
    expect(vainqueurClassique(c, A, B)).toEqual({ vainqueur: "A", condition: "premiere_tour" });
  });

  it("100 sbires atteints avant tout le reste", () => {
    const c = chronologie([0, 30, 60, 90, 104, 110], [0, 28, 55, 80, 96, 101], [
      { type: "CHAMPION_KILL", timestamp: 5 * MINUTE + 30_000, killerId: 2, victimId: 1 },
    ]);
    expect(vainqueurClassique(c, A, B)).toEqual({ vainqueur: "A", condition: "sbires" });
  });

  it("un évènement dans la minute où l'autre franchit 100 sbires : impossible à ordonner, jamais deviné", () => {
    // A atteint 100 sbires entre 3:00 et 4:00 ; B meurt… non : A meurt à 3:30 (B gagnerait).
    const c = chronologie([0, 30, 60, 90, 104], [0, 20, 40, 60, 80], [
      { type: "CHAMPION_KILL", timestamp: 3 * MINUTE + 30_000, killerId: 2, victimId: 1 },
    ]);
    expect(vainqueurClassique(c, A, B)).toBe("ambigu");
  });

  it("un évènement pile à l'image précédente précède le franchissement des 100 sbires", () => {
    const c = chronologie([0, 30, 60, 90, 104], [0, 20, 40, 60, 80], [
      { type: "CHAMPION_KILL", timestamp: 3 * MINUTE, killerId: 2, victimId: 1 },
    ]);
    expect(vainqueurClassique(c, A, B)).toEqual({ vainqueur: "B", condition: "premier_sang" });
  });

  it("deux conditions dans la même minute pour le même joueur : il gagne", () => {
    const c = chronologie([0, 30, 60, 90, 104], [0, 20, 40, 60, 80], [
      { type: "CHAMPION_KILL", timestamp: 3 * MINUTE + 30_000, killerId: 1, victimId: 2 },
    ]);
    expect(vainqueurClassique(c, A, B)).toEqual({ vainqueur: "A", condition: "premier_sang" });
  });

  it("les deux joueurs franchissent 100 sbires dans la même minute : ambigu", () => {
    const c = chronologie([0, 30, 60, 90, 101], [0, 30, 60, 90, 102]);
    expect(vainqueurClassique(c, A, B)).toBe("ambigu");
  });

  it("aucune condition remplie (partie quittée tôt) : pas de vainqueur", () => {
    expect(vainqueurClassique(chronologie([0, 10], [0, 9]), A, B)).toBeNull();
  });
});
