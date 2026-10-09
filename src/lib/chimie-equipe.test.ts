import { describe, expect, it } from "vitest";
import { chimieEquipe, pourcentageVictoires } from "./chimie-equipe";

const titulaires = ["a", "b", "c", "d", "e"];
const avecRemplacant = ["a", "b", "c", "d", "f"];

describe("chimieEquipe", () => {
  it("rien sous 3 matchs vérifiés", () => {
    expect(chimieEquipe([{ gagne: true, joueurs: titulaires }])).toBeNull();
  });

  it("compositions, duos et bilan avec ou sans chaque joueur", () => {
    const chimie = chimieEquipe([
      { gagne: true, joueurs: titulaires },
      { gagne: false, joueurs: titulaires },
      { gagne: true, joueurs: avecRemplacant },
      { gagne: true, joueurs: avecRemplacant },
      { gagne: true, joueurs: avecRemplacant },
    ])!;
    expect(chimie.total).toEqual({ matchs: 5, victoires: 4 });
    // La composition avec le remplaçant d'abord : plus de matchs.
    expect(chimie.compositions).toEqual([
      { joueurs: avecRemplacant, matchs: 3, victoires: 3 },
      { joueurs: titulaires, matchs: 2, victoires: 1 },
    ]);
    // Le duo a-b a joué les 5 matchs.
    expect(chimie.duos[0]).toEqual({ joueurs: ["a", "b"], matchs: 5, victoires: 4 });
    // e n'a joué que 2 matchs, f 3 ; aucun duo avec e et f.
    expect(chimie.duos.some((d) => d.joueurs.includes("e") && d.joueurs.includes("f"))).toBe(false);
    const e = chimie.joueurs.find((j) => j.id === "e")!;
    expect(e).toEqual({ id: "e", avec: { matchs: 2, victoires: 1 }, sans: { matchs: 3, victoires: 3 } });
    expect(chimie.joueurs.find((j) => j.id === "a")!.sans).toBeNull();
  });

  it("un duo ou une composition d'un seul match n'est pas montré", () => {
    const chimie = chimieEquipe([
      { gagne: true, joueurs: titulaires },
      { gagne: true, joueurs: avecRemplacant },
      { gagne: false, joueurs: ["a", "b", "c", "g", "h"] },
    ])!;
    expect(chimie.compositions).toEqual([]);
    expect(chimie.duos.every((d) => d.matchs >= 2)).toBe(true);
  });
});

describe("pourcentageVictoires", () => {
  it("arrondi, et 0 sans match", () => {
    expect(pourcentageVictoires({ matchs: 3, victoires: 2 })).toBe(67);
    expect(pourcentageVictoires({ matchs: 0, victoires: 0 })).toBe(0);
  });
});
