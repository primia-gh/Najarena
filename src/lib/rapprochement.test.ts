import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetailsMatchRiot, ParticipantMatchRiot } from "@/lib/riot";

// L'API Riot est simulée : ces tests vérifient les critères de
// rapprochement (docs/moteur-resultats.md §3) sans réseau.
const parties = new Map<string, DetailsMatchRiot>();
const idsParJoueur = new Map<string, string[]>();

vi.mock("@/lib/riot", () => ({
  trouverRegion: () => ({ code: "EUW", continent: "europe" }),
  recupererIdsMatchsRecents: vi.fn(async (puuid: string) => idsParJoueur.get(puuid) ?? []),
  recupererDetailsMatch: vi.fn(async (id: string) => {
    const partie = parties.get(id);
    if (!partie) throw new Error(`partie inconnue ${id}`);
    return partie;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ creerClientAdmin: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  envoyerRappel: vi.fn(),
  notifierJoueur: vi.fn(),
  notifierDiscord: vi.fn(),
  URL_SITE: "http://localhost:3000",
}));
vi.mock("@/lib/classement-actions", () => ({ cloturerTournoi: vi.fn() }));

const { trouverSerieCorrespondante } = await import("./rapprochement");
const riot = await import("@/lib/riot");

const OUVERTURE = new Date("2026-09-28T19:00:00Z");
const MINUTE = 60_000;

function joueur(puuid: string, win: boolean): ParticipantMatchRiot {
  return {
    puuid,
    win,
    championName: "Ahri",
    kills: 1,
    deaths: 0,
    assists: 0,
    totalMinionsKilled: 100,
    neutralMinionsKilled: 0,
    goldEarned: 3000,
  };
}

function ajouterPartie(
  id: string,
  options: {
    debutMinutes: number;
    gagnant: "A" | "B";
    dureeSecondes?: number;
    queueId?: number;
    autres?: number;
  },
) {
  const participants = [joueur("A", options.gagnant === "A"), joueur("B", options.gagnant === "B")];
  for (let i = 0; i < (options.autres ?? 0); i++) participants.push(joueur(`X${i}`, i % 2 === 0));
  parties.set(id, {
    info: {
      gameStartTimestamp: OUVERTURE.getTime() + options.debutMinutes * MINUTE,
      gameDuration: options.dureeSecondes ?? 900,
      queueId: options.queueId ?? 0,
      participants,
    },
  });
  idsParJoueur.set("A", [id, ...(idsParJoueur.get("A") ?? [])]);
}

beforeEach(() => {
  parties.clear();
  idsParJoueur.clear();
  vi.mocked(riot.recupererDetailsMatch).mockClear();
});

describe("trouverSerieCorrespondante", () => {
  it("Bo1 : retrouve la partie et son vainqueur", async () => {
    ajouterPartie("EUW1_1", { debutMinutes: 5, gagnant: "B" });
    const serie = await trouverSerieCorrespondante("A", "B", "europe", OUVERTURE, 1, true);
    expect(serie?.gagnantPuuid).toBe("B");
    expect(serie?.parties.map((p) => p.riotMatchId)).toEqual(["EUW1_1"]);
  });

  it("ignore un remake, une partie antérieure, une partie non personnalisée et une partie à dix", async () => {
    ajouterPartie("remake", { debutMinutes: 5, gagnant: "A", dureeSecondes: 200 });
    ajouterPartie("avant", { debutMinutes: -30, gagnant: "A" });
    ajouterPartie("classee", { debutMinutes: 6, gagnant: "A", queueId: 420 });
    ajouterPartie("a-dix", { debutMinutes: 7, gagnant: "A", autres: 8 });
    expect(await trouverSerieCorrespondante("A", "B", "europe", OUVERTURE, 1, true)).toBeNull();
  });

  it("Bo3 : attend la manche décisive, puis rend les trois parties", async () => {
    ajouterPartie("m1", { debutMinutes: 5, gagnant: "A" });
    ajouterPartie("m2", { debutMinutes: 30, gagnant: "B" });
    expect(await trouverSerieCorrespondante("A", "B", "europe", OUVERTURE, 3, true)).toBeNull();

    ajouterPartie("m3", { debutMinutes: 55, gagnant: "B" });
    const serie = await trouverSerieCorrespondante("A", "B", "europe", OUVERTURE, 3, true);
    expect(serie?.gagnantPuuid).toBe("B");
    expect(serie?.parties.map((p) => p.riotMatchId)).toEqual(["m1", "m2", "m3"]);
  });

  it("une partie déjà lue n'est pas redemandée à Riot pendant le même passage", async () => {
    ajouterPartie("EUW1_1", { debutMinutes: 5, gagnant: "A" });
    const cache = new Map();
    await trouverSerieCorrespondante("A", "B", "europe", OUVERTURE, 1, true, cache);
    await trouverSerieCorrespondante("A", "B", "europe", OUVERTURE, 1, true, cache);
    expect(riot.recupererDetailsMatch).toHaveBeenCalledTimes(1);
  });
});
