import { describe, expect, it } from "vitest";
import type { ParticipantMatchRiot } from "./riot";
import { detailsPartie, patchDeVersion, posteDeLaPartie } from "./capture-partie";

// Extrait d'une fiche de partie match-v5 (valeurs d'exemple).
const ahri: ParticipantMatchRiot = {
  puuid: "p-ahri",
  win: true,
  teamId: 100,
  championName: "Ahri",
  championId: 103,
  champLevel: 13,
  teamPosition: "",
  kills: 3,
  deaths: 1,
  assists: 2,
  totalMinionsKilled: 140,
  neutralMinionsKilled: 10,
  goldEarned: 6000,
  item0: 6655,
  item1: 3020,
  item2: 0,
  item3: 1056,
  item4: 0,
  item5: 0,
  item6: 3340,
  summoner1Id: 14,
  summoner2Id: 4,
  perks: {
    statPerks: { offense: 5008, flex: 5008, defense: 5011 },
    styles: [
      { description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8139 }, { perk: 8138 }, { perk: 8106 }] },
      { description: "subStyle", style: 8200, selections: [{ perk: 8226 }, { perk: 8210 }] },
    ],
  },
  totalDamageDealtToChampions: 9000.4,
  totalDamageTaken: 7000,
  damageSelfMitigated: 2500,
  damageDealtToBuildings: 1200,
  totalHeal: 800,
  timeCCingOthers: 12,
  visionScore: 0,
  wardsPlaced: 0,
  wardsKilled: 0,
  detectorWardsPlaced: 0,
  turretTakedowns: 1,
  firstBloodKill: true,
  firstTowerKill: false,
  firstTowerAssist: false,
  largestMultiKill: 1,
  totalTimeSpentDead: 18,
  challenges: { soloKills: 3, killParticipation: 1, teamDamagePercentage: 1.0000001, laneMinionsFirst10Minutes: 72 },
};

describe("detailsPartie", () => {
  it("garde objets, runes, sorts, dégâts et objectifs de la fiche Riot", () => {
    const d = detailsPartie(ahri, { versionJeu: "15.19.715.1234", debut: Date.UTC(2026, 9, 4, 19, 0) });
    expect(d.objets).toEqual([6655, 3020, 1056]);
    expect(d.balise).toBe(3340);
    expect(d.sorts).toEqual([14, 4]);
    expect(d.style_principal).toBe(8100);
    expect(d.rune_principale).toBe(8112);
    expect(d.runes).toEqual([8112, 8139, 8138, 8106, 8226, 8210]);
    expect(d.style_secondaire).toBe(8200);
    expect(d.fragments).toEqual([5008, 5008, 5011]);
    expect(d.degats_champions).toBe(9000);
    expect(d.premier_sang).toBe(true);
    expect(d.premiere_tour).toBe(false);
    expect(d.part_degats).toBe(1);
    expect(d.sbires_10).toBe(72);
    expect(d.patch).toBe("15.19");
    expect(d.joue_le).toBe("2026-10-04T19:00:00.000Z");
    expect(d.poste).toBeNull();
  });

  it("laisse vide ce que Riot n'a pas donné", () => {
    const minimal: ParticipantMatchRiot = {
      puuid: "p",
      win: false,
      championName: "Zed",
      kills: 0,
      deaths: 0,
      assists: 0,
      totalMinionsKilled: 0,
      neutralMinionsKilled: 0,
      goldEarned: 0,
    };
    const d = detailsPartie(minimal, {});
    expect(d.objets).toEqual([]);
    expect(d.rune_principale).toBeNull();
    expect(d.premier_sang).toBeNull();
    expect(d.premiere_tour).toBeNull();
    expect(d.part_kills).toBeNull();
    expect(d.patch).toBeNull();
    expect(d.joue_le).toBeNull();
  });
});

describe("poste et patch", () => {
  it("prend le poste donné par Riot, sinon le déduit seulement sans ambiguïté", () => {
    expect(posteDeLaPartie({ ...ahri, teamPosition: "MIDDLE" })).toBe("MIDDLE");
    expect(posteDeLaPartie({ ...ahri, summoner2Id: 11 })).toBe("JUNGLE");
    expect(posteDeLaPartie({ ...ahri, item0: 3865 })).toBe("UTILITY");
    expect(posteDeLaPartie(ahri)).toBeNull();
  });

  it("lit le patch dans la version du jeu", () => {
    expect(patchDeVersion("15.19.715.1234")).toBe("15.19");
    expect(patchDeVersion("16.1")).toBe("16.1");
    expect(patchDeVersion("version inconnue")).toBeNull();
    expect(patchDeVersion(undefined)).toBeNull();
  });
});
