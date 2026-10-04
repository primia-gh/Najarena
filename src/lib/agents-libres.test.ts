import { describe, expect, it } from "vitest";
import { formerEquipes, type AgentLibre } from "./agents-libres";
import type { Role } from "./roles";

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

function agent(i: number, rating: number | null, role: Role | null = null): AgentLibre {
  return { profileId: `j${String(i).padStart(2, "0")}`, rating, role };
}

describe("formerEquipes", () => {
  it("forme des équipes de cinq aux ratings voisins, capitaine = meilleur rating", () => {
    const agents = Array.from({ length: 10 }, (_, i) => agent(i, 1200 + i * 60));
    const { equipes, restants } = formerEquipes(agents, 8);
    expect(equipes).toHaveLength(2);
    expect(restants).toEqual([]);
    const somme = (e: string[]) => e.reduce((t, id) => t + agents.find((a) => a.profileId === id)!.rating!, 0);
    expect(Math.abs(somme(equipes[0]) - somme(equipes[1]))).toBeLessThanOrEqual(60);
    for (const e of equipes) {
      const ratings = e.map((id) => agents.find((a) => a.profileId === id)!.rating!);
      expect(ratings[0]).toBe(Math.max(...ratings));
    }
  });

  it("sert les premiers inscrits ; les autres attendent", () => {
    const agents = Array.from({ length: 13 }, (_, i) => agent(i, 1500));
    const { equipes, restants } = formerEquipes(agents, 8);
    expect(equipes).toHaveLength(2);
    expect(restants).toEqual(["j10", "j11", "j12"]);
  });

  it("ne dépasse pas les places du bracket", () => {
    const agents = Array.from({ length: 15 }, (_, i) => agent(i, 1500));
    expect(formerEquipes(agents, 1).equipes).toHaveLength(1);
    expect(formerEquipes(agents, 0)).toEqual({ equipes: [], restants: agents.map((a) => a.profileId) });
  });

  it("évite les doublons de rôle entre joueurs de niveau proche", () => {
    // Deux mids et deux tops de même niveau : le serpentin les mettrait
    // ensemble ; les échanges rendent un rôle de chaque à chaque équipe.
    const agents = [
      agent(0, 1600, "mid"),
      agent(1, 1600, "mid"),
      agent(2, 1550, "top"),
      agent(3, 1550, "top"),
      agent(4, 1500, "jungle"),
      agent(5, 1500, "jungle"),
      agent(6, 1450, "adc"),
      agent(7, 1450, "adc"),
      agent(8, 1400, "support"),
      agent(9, 1400, "support"),
    ];
    const { equipes } = formerEquipes(agents, 8);
    for (const e of equipes) {
      const roles = e.map((id) => agents.find((a) => a.profileId === id)!.role);
      expect(new Set(roles).size).toBe(ROLES.length);
    }
  });
});
