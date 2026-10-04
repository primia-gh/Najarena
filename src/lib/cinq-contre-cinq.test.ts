import { describe, expect, it } from "vitest";
import type { ParticipantMatchRiot } from "@/lib/riot";
import { alignementsDansLaPartie, libelleEquipe, membresAlignables, parcoursDansTournoi } from "./cinq-contre-cinq";

function joueur(puuid: string, teamId: number | undefined, win: boolean): ParticipantMatchRiot {
  return {
    puuid,
    win,
    teamId,
    championName: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    totalMinionsKilled: 0,
    neutralMinionsKilled: 0,
    goldEarned: 0,
  };
}

const A = ["a1", "a2", "a3", "a4", "a5"];
const B = ["b1", "b2", "b3", "b4", "b5"];

function partie(bleus: string[], rouges: string[], avecTeamId = true): ParticipantMatchRiot[] {
  return [
    ...bleus.map((p) => joueur(p, avecTeamId ? 100 : undefined, true)),
    ...rouges.map((p) => joueur(p, avecTeamId ? 200 : undefined, false)),
  ];
}

describe("alignementsDansLaPartie", () => {
  it("retient une partie à dix, chaque équipe de son côté", () => {
    expect(alignementsDansLaPartie(partie(A, B), { a: A, b: B })).toBe(true);
    expect(alignementsDansLaPartie(partie(B, A), { a: A, b: B })).toBe(true);
  });

  it("se contente de l'issue de la partie quand Riot ne donne pas les camps", () => {
    expect(alignementsDansLaPartie(partie(A, B, false), { a: A, b: B })).toBe(true);
  });

  it("refuse un remplaçant non inscrit", () => {
    expect(alignementsDansLaPartie(partie(["a1", "a2", "a3", "a4", "x9"], B), { a: A, b: B })).toBe(false);
  });

  it("refuse un joueur passé dans l'autre camp", () => {
    const melange = partie(["a1", "a2", "a3", "a4", "b5"], ["b1", "b2", "b3", "b4", "a5"]);
    expect(alignementsDansLaPartie(melange, { a: A, b: B })).toBe(false);
  });

  it("refuse une partie qui n'est pas à dix", () => {
    expect(alignementsDansLaPartie(partie(A.slice(0, 4), B), { a: A, b: B })).toBe(false);
  });
});

describe("libelleEquipe et membresAlignables", () => {
  it("nomme l'équipe avec son tag", () => {
    expect(libelleEquipe("VEN", "Venin")).toBe("[VEN] Venin");
    expect(libelleEquipe(null, "Venin")).toBe("Venin");
    expect(libelleEquipe("VEN", null)).toBe("Équipe inconnue");
  });

  it("ne propose que les membres acceptés, capitaine en tête", () => {
    const membres = [
      { profileId: "m1", accepte: true },
      { profileId: "cap", accepte: true },
      { profileId: "invite", accepte: false },
    ];
    expect(membresAlignables(membres, "cap").map((m) => m.profileId)).toEqual(["cap", "m1"]);
  });
});

describe("parcoursDansTournoi", () => {
  it("vainqueur d'un tournoi à 8 équipes, victoires vérifiées comptées", () => {
    const p = parcoursDansTournoi({
      statut: "termine",
      capacite: 8,
      matchs: [
        { tour: 1, estGagnant: true, verifie: true },
        { tour: 2, estGagnant: true, verifie: false },
        { tour: 3, estGagnant: true, verifie: true },
      ],
    });
    expect(p).toEqual({ libelle: "Vainqueur", victoiresVerifiees: 2 });
  });

  it("dit où l'équipe s'est arrêtée", () => {
    const elimine = (tour: number) =>
      parcoursDansTournoi({ statut: "termine", capacite: 16, matchs: [{ tour, estGagnant: false, verifie: true }] })
        .libelle;
    expect(elimine(4)).toBe("Finaliste");
    expect(elimine(3)).toBe("Demi-finaliste");
    expect(elimine(2)).toBe("Quart de finaliste");
    expect(elimine(1)).toBe("Éliminée au tour 1");
  });

  it("inscrite, en lice, annulé", () => {
    expect(parcoursDansTournoi({ statut: "ouvert", capacite: 8, matchs: [] }).libelle).toBe("Inscrite");
    expect(
      parcoursDansTournoi({ statut: "en_cours", capacite: 8, matchs: [{ tour: 1, estGagnant: null, verifie: false }] })
        .libelle,
    ).toBe("En lice");
    expect(parcoursDansTournoi({ statut: "annule", capacite: 8, matchs: [] }).libelle).toBe("Tournoi annulé");
  });
});
