import { describe, expect, it } from "vitest";
import { bornesSemaine, construireRecap, estUnLundi, lundiDeLaSemaine, messageRecap } from "./recap-semaine";

const paliers = [
  { nom: "Bronze", ratingMin: 0 },
  { nom: "Argent", ratingMin: 1300 },
  { nom: "Or", ratingMin: 1450 },
  { nom: "Platine", ratingMin: 1600 },
];

describe("semaine", () => {
  it("trouve le lundi de la semaine, à l'heure de Paris", () => {
    expect(lundiDeLaSemaine(new Date("2026-09-28T10:00:00Z"))).toBe("2026-09-28"); // lundi
    expect(lundiDeLaSemaine(new Date("2026-10-04T21:30:00Z"))).toBe("2026-09-28"); // dimanche 23 h 30 à Paris
    expect(lundiDeLaSemaine(new Date("2026-10-04T22:30:00Z"))).toBe("2026-10-05"); // déjà lundi à Paris
    expect(estUnLundi("2026-09-28")).toBe(true);
    expect(estUnLundi("2026-09-29")).toBe(false);
    expect(estUnLundi("2026-02-30")).toBe(false);
  });

  it("borne la semaine du lundi minuit au lundi suivant, heure de Paris", () => {
    const { debut, fin } = bornesSemaine("2026-09-28");
    expect(debut.toISOString()).toBe("2026-09-27T22:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-10-04T22:00:00.000Z");
  });
});

describe("récap de la semaine", () => {
  const variations = [
    { profileId: "a", tournoiId: "t1", avant: 1440, rdAvant: 100, apres: 1520, rdApres: 95, le: "2026-09-29T20:00:00Z" },
    { profileId: "b", tournoiId: "t1", avant: 1500, rdAvant: 300, apres: 1470, rdApres: 280, le: "2026-09-29T20:00:00Z" },
    { profileId: "a", tournoiId: "t2", avant: 1520, rdAvant: 95, apres: 1610, rdApres: 90, le: "2026-10-01T20:00:00Z" },
    { profileId: "c", tournoiId: "t2", avant: 1700, rdAvant: 60, apres: 1650, rdApres: 60, le: "2026-10-01T20:00:00Z" },
  ];
  const matchs = [
    { tournoiId: "t1", joueurs: ["a", "b"], gagnantId: "a" },
    { tournoiId: "t2", joueurs: ["a", "c"], gagnantId: "a" },
  ];

  it("ne publie rien pour une semaine sans tournoi clôturé", () => {
    expect(construireRecap([], [], paliers)).toBeNull();
  });

  it("donne progressions, exploit, nouveaux paliers et joueurs actifs", () => {
    const recap = construireRecap(variations, matchs, paliers);
    expect(recap?.tournois).toBe(2);
    expect(recap?.progressions).toEqual([{ profileId: "a", gain: 170 }]);
    expect(recap?.nouveauxPaliers).toEqual([{ profileId: "a", palier: "Platine" }]);
    expect(recap?.exploit?.gagnantId).toBe("a");
    expect(recap?.exploit?.perdantId).toBe("c");
    expect(recap?.actifs[0]).toEqual({ profileId: "a", matchs: 2 });
  });

  it("n'annonce pas de nouveau palier à un joueur encore provisoire", () => {
    const recap = construireRecap(
      [{ profileId: "b", tournoiId: "t1", avant: 1440, rdAvant: 300, apres: 1470, rdApres: 280, le: "2026-09-29T20:00:00Z" }],
      [],
      paliers,
    );
    expect(recap?.nouveauxPaliers).toEqual([]);
  });

  it("écrit le message Discord du lundi", () => {
    const recap = construireRecap(variations, matchs, paliers)!;
    const message = messageRecap(recap, (id) => id.toUpperCase(), "https://x/lol/semaine/2026-09-28");
    expect(message).toContain("2 tournois clôturés, 2 matchs vérifiés");
    expect(message).toContain("Plus fortes progressions : A (+170).");
    expect(message).toContain("Nouveaux paliers : A → Platine.");
  });
});
