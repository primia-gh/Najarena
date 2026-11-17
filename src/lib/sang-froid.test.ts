import { describe, expect, it } from "vitest";
import type { PartieBilan } from "./bilan";
import { sangFroid } from "./sang-froid";

let n = 0;
function partie(format: PartieBilan["format"], poste: string | null, valeurs: PartieBilan["valeurs"]): PartieBilan {
  n += 1;
  return {
    matchId: `m${n}`,
    format,
    champion: "Ahri",
    championId: 103,
    poste,
    gagne: n % 2 === 0,
    joueLe: new Date(Date.UTC(2026, 8, 1) + n * 3_600_000).toISOString(),
    kills: 3,
    deaths: 2,
    assists: 4,
    valeurs,
    objets: [],
    runePrincipale: null,
    styleSecondaire: null,
    sorts: [],
  };
}

const classees = Array.from({ length: 12 }, (_, i) =>
  partie("classees", "MIDDLE", {
    sbires_min: i % 2 === 0 ? 7 : 8,
    morts_10min: i % 2 === 0 ? 1 : 2,
    degats_min: i % 2 === 0 ? 700 : 800,
  }),
);

describe("sangFroid", () => {
  it("se crispe en tournoi : chiffres plus bas qu'en classée, au même poste", () => {
    const tournoi = Array.from({ length: 6 }, () =>
      partie("5v5", "MIDDLE", { sbires_min: 6.5, morts_10min: 2.5, degats_min: 650 }),
    );
    const resultat = sangFroid(tournoi, classees);
    expect(resultat).toMatchObject({ verdict: "crispe", poste: "MIDDLE", partiesTournoi: 6, partiesClassees: 12 });
    expect(resultat?.ecarts.map((e) => e.indicateur)).toEqual(["sbires_min", "morts_10min", "degats_min"]);
    expect(resultat?.ecarts[1]).toMatchObject({ tournoi: 2.5, classees: 1.5 });
    expect(resultat?.indice).toBeCloseTo(-1.915, 2);
  });

  it("joue en tournoi comme en classée", () => {
    const tournoi = Array.from({ length: 5 }, () =>
      partie("5v5", "MIDDLE", { sbires_min: 7.5, morts_10min: 1.5, degats_min: 750 }),
    );
    expect(sangFroid(tournoi, classees)).toMatchObject({ verdict: "constant", indice: 0 });
  });

  it("sans poste connu en tournoi, compare toutes les parties", () => {
    const tournoi = Array.from({ length: 5 }, () => partie("5v5", null, { sbires_min: 9, morts_10min: 0.5, degats_min: 900 }));
    expect(sangFroid(tournoi, classees)).toMatchObject({ verdict: "pression_positive", poste: null });
  });

  it("rien sous 5 parties de tournoi, ni sous 3 indicateurs comparables", () => {
    const peu = Array.from({ length: 4 }, () => partie("5v5", "MIDDLE", { sbires_min: 7, morts_10min: 1, degats_min: 700 }));
    expect(sangFroid(peu, classees)).toBeNull();
    const deuxIndicateurs = Array.from({ length: 6 }, () => partie("5v5", "MIDDLE", { sbires_min: 7, morts_10min: 1 }));
    expect(sangFroid(deuxIndicateurs, classees)).toBeNull();
  });
});
