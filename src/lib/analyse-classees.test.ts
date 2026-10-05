import { describe, expect, it } from "vitest";
import type { ChronologieRiot } from "./conditions-1v1";
import type { DetailsMatchRiot, ParticipantMatchRiot } from "./riot";
import {
  budgetAppels,
  chronologiePartieClassee,
  fenetreLecture,
  fichePartieClassee,
  joueursARelire,
  libelleRang,
  rangARelire,
  rangDepuisEntrees,
} from "./analyse-classees";

function participant(puuid: string, teamId: number, teamPosition: string, autres: Partial<ParticipantMatchRiot> = {}): ParticipantMatchRiot {
  return {
    puuid,
    win: teamId === 100,
    teamId,
    championName: "Ahri",
    teamPosition,
    kills: 5,
    deaths: 2,
    assists: 7,
    totalMinionsKilled: 200,
    neutralMinionsKilled: 12,
    goldEarned: 13000,
    ...autres,
  };
}

const details: DetailsMatchRiot = {
  info: {
    gameStartTimestamp: Date.UTC(2026, 9, 1, 18, 0),
    gameDuration: 1860,
    queueId: 420,
    gameVersion: "15.19.715.1234",
    participants: [
      participant("p-moi", 100, "MIDDLE", { championId: 103, item0: 6655, summoner1Id: 4, summoner2Id: 14 }),
      participant("p-jungle", 100, "JUNGLE"),
      participant("p-adverse", 200, "MIDDLE", { championName: "Zed" }),
      participant("p-autre", 200, "TOP"),
    ],
  },
};

const chronologie: ChronologieRiot = {
  info: {
    participants: [
      { participantId: 1, puuid: "p-moi" },
      { participantId: 2, puuid: "p-jungle" },
      { participantId: 6, puuid: "p-adverse" },
      { participantId: 7, puuid: "p-autre" },
    ],
    frames: [
      { timestamp: 0, participantFrames: { "1": { totalGold: 500 }, "6": { totalGold: 500 } } },
      {
        timestamp: 540_012,
        events: [
          { type: "CHAMPION_KILL", timestamp: 300_400, killerId: 6, victimId: 1, position: { x: 7000, y: 7200 } },
          { type: "CHAMPION_KILL", timestamp: 420_000, killerId: 1, victimId: 6, position: { x: 7300, y: 7400 } },
        ],
      },
      { timestamp: 900_040, participantFrames: { "1": { totalGold: 6100 }, "6": { totalGold: 5400 } } },
      {
        timestamp: 1_200_000,
        events: [{ type: "CHAMPION_KILL", timestamp: 1_100_900, killerId: 7, victimId: 1, position: { x: 2000, y: 12000 } }],
      },
    ],
  },
};

describe("rang Riot", () => {
  it("prend la Solo/Duo, sinon la Flexible ; pas de division au-delà de Diamant", () => {
    const solo = { queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "II", leaguePoints: 45, wins: 10, losses: 8 };
    const flex = { queueType: "RANKED_FLEX_SR", tier: "PLATINUM", rank: "IV", leaguePoints: 3, wins: 4, losses: 2 };
    expect(rangDepuisEntrees([flex, solo])).toEqual({ palier: "GOLD", division: "II", points: 45, file: "solo" });
    expect(rangDepuisEntrees([flex])).toMatchObject({ palier: "PLATINUM", file: "flex" });
    expect(rangDepuisEntrees([{ ...solo, tier: "MASTER", rank: "I", leaguePoints: 120 }])).toMatchObject({
      palier: "MASTER",
      division: null,
    });
    expect(rangDepuisEntrees([{ ...solo, tier: "INCONNU" }])).toBeNull();
    expect(rangDepuisEntrees([])).toBeNull();
  });

  it("affiche le rang en français", () => {
    expect(libelleRang("GOLD", "II", 45)).toBe("Or II · 45 PL");
    expect(libelleRang("MASTER", null, 120)).toBe("Maître · 120 PL");
    expect(libelleRang(null, null, null)).toBeNull();
  });
});

describe("fichePartieClassee", () => {
  it("garde les chiffres du joueur, pas ceux des autres", () => {
    const fiche = fichePartieClassee(details, "p-moi", "GOLD");
    expect(fiche.ignoree).toBe(false);
    if (fiche.ignoree) return;
    expect(fiche.colonnes).toMatchObject({
      file: 420,
      joue_le: "2026-10-01T18:00:00.000Z",
      duree_secondes: 1860,
      patch: "15.19",
      palier: "GOLD",
      gagne: true,
      equipe: 100,
      champion: "Ahri",
      champion_id: 103,
      poste: "MIDDLE",
      cs: 212,
      or_gagne: 13000,
      objets: [6655],
      sorts: [4, 14],
    });
  });

  it("ignore une file non classée, un abandon anticipé, un joueur absent", () => {
    expect(fichePartieClassee({ info: { ...details.info, queueId: 450 } }, "p-moi", null)).toMatchObject({ ignoree: true });
    expect(
      fichePartieClassee(
        {
          info: {
            ...details.info,
            participants: [participant("p-moi", 100, "MIDDLE", { gameEndedInEarlySurrender: true })],
          },
        },
        "p-moi",
        null,
      ),
    ).toMatchObject({ ignoree: true, raison: "partie arrêtée avant 5 minutes" });
    expect(fichePartieClassee(details, "p-inconnu", null)).toMatchObject({ ignoree: true });
  });
});

describe("chronologiePartieClassee", () => {
  it("écart d'or avec le vis-à-vis à 15 minutes, morts avant 10 minutes, lieu de chaque mort", () => {
    expect(chronologiePartieClassee(chronologie, details, "p-moi")).toEqual({
      ecart_or_15: 700,
      morts_avant_10: 1,
      morts_secondes: [300, 1101],
      morts_x: [7000, 2000],
      morts_y: [7200, 12000],
    });
  });

  it("sans vis-à-vis au même poste ni image à 15 minutes, pas d'écart d'or", () => {
    const sansPoste: DetailsMatchRiot = {
      info: { ...details.info, participants: details.info.participants.map((p) => ({ ...p, teamPosition: "" })) },
    };
    expect(chronologiePartieClassee(chronologie, sansPoste, "p-moi")?.ecart_or_15).toBeNull();
    const courte: ChronologieRiot = { info: { ...chronologie.info, frames: chronologie.info.frames.slice(0, 2) } };
    expect(chronologiePartieClassee(courte, details, "p-moi")?.ecart_or_15).toBeNull();
    expect(chronologiePartieClassee(chronologie, details, "p-inconnu")).toBeNull();
  });
});

describe("planification", () => {
  const maintenant = new Date("2026-10-05T12:00:00Z");

  it("relit les joueurs jamais lus d'abord, puis ceux lus il y a plus de 6 heures", () => {
    const reglages = [
      { profile_id: "a", derniere_synchro: "2026-10-05T09:00:00Z", rang_lu_le: null },
      { profile_id: "b", derniere_synchro: null, rang_lu_le: null },
      { profile_id: "c", derniere_synchro: "2026-10-04T20:00:00Z", rang_lu_le: null },
      { profile_id: "d", derniere_synchro: "2026-10-05T05:00:00Z", rang_lu_le: null },
    ];
    expect(joueursARelire(reglages, maintenant, 5).map((r) => r.profile_id)).toEqual(["b", "c", "d"]);
    expect(joueursARelire(reglages, maintenant, 1).map((r) => r.profile_id)).toEqual(["b"]);
  });

  it("relit le rang une fois par jour", () => {
    expect(rangARelire(null, maintenant)).toBe(true);
    expect(rangARelire("2026-10-04T11:00:00Z", maintenant)).toBe(true);
    expect(rangARelire("2026-10-05T08:00:00Z", maintenant)).toBe(false);
  });

  it("première lecture : 30 parties sur 90 jours ; ensuite, depuis la dernière gardée", () => {
    const plancher = Math.floor(maintenant.getTime() / 1000) - 90 * 86_400;
    expect(fenetreLecture(null, maintenant)).toEqual({ depuisSecondes: plancher, nombre: 30 });
    expect(fenetreLecture("2026-10-04T18:00:00Z", maintenant)).toEqual({
      depuisSecondes: Date.UTC(2026, 9, 4, 18) / 1000 + 1,
      nombre: 20,
    });
    expect(fenetreLecture("2026-01-01T00:00:00Z", maintenant).depuisSecondes).toBe(plancher);
  });

  it("budget d'appels réglable, 20 par défaut, 500 au plus", () => {
    expect(budgetAppels(undefined)).toBe(20);
    expect(budgetAppels("")).toBe(20);
    expect(budgetAppels("abc")).toBe(20);
    expect(budgetAppels("120")).toBe(120);
    expect(budgetAppels("9999")).toBe(500);
    expect(budgetAppels("-3")).toBe(0);
  });
});
