import { describe, expect, it, vi } from "vitest";
import { DELAI_APPEL_MS, parcourirRevues, type IssueRevue } from "./revue-ia-serveur";

const a = { match_id: "m1", profile_id: "p1" };
const b = { match_id: "m2", profile_id: "p2" };
const fixe = () => 0;

describe("parcourirRevues", () => {
  it("rédige chaque revue demandée", async () => {
    const rediger = vi.fn(async (): Promise<IssueRevue> => "ok");
    const noter = vi.fn(async () => undefined);
    expect(await parcourirRevues([a, b], rediger, noter, 60_000, fixe)).toEqual({ redigees: 2, echecs: 0 });
    expect(noter).not.toHaveBeenCalled();
  });

  it("note une réponse refusée, puis continue", async () => {
    const issues: IssueRevue[] = ["refus", "ok"];
    const noter = vi.fn(async () => undefined);
    const bilan = await parcourirRevues([a, b], async () => issues.shift() ?? "ok", noter, 60_000, fixe);
    expect(bilan).toEqual({ redigees: 1, echecs: 1 });
    expect(noter).toHaveBeenCalledWith("m1", "p1");
  });

  it("s'arrête si l'IA est injoignable, sans rien noter", async () => {
    const rediger = vi.fn(async (): Promise<IssueRevue> => "indisponible");
    const noter = vi.fn(async () => undefined);
    expect(await parcourirRevues([a, b], rediger, noter, 60_000, fixe)).toEqual({ redigees: 0, echecs: 1 });
    expect(rediger).toHaveBeenCalledTimes(1);
    expect(noter).not.toHaveBeenCalled();
  });

  it("ne commence pas une revue qui finirait après la limite de la tâche", async () => {
    const rediger = vi.fn(async (): Promise<IssueRevue> => "ok");
    expect(await parcourirRevues([a], rediger, vi.fn(), DELAI_APPEL_MS - 1, fixe)).toEqual({ redigees: 0, echecs: 0 });
    expect(rediger).not.toHaveBeenCalled();
  });
});
