import { describe, expect, it } from "vitest";
import { issuePronostic, partsPronostics, pointsPronostic, pronosticOuvert } from "./pronostics";

describe("pointsPronostic", () => {
  it("2 en finale, 1 en demi-finale, 0 avant", () => {
    expect(pointsPronostic(3, 8)).toBe(2);
    expect(pointsPronostic(2, 8)).toBe(1);
    expect(pointsPronostic(1, 8)).toBe(0);
    expect(pointsPronostic(1, 4)).toBe(1);
    expect(pointsPronostic(1, 2)).toBe(0);
  });
});

describe("pronosticOuvert", () => {
  const base = {
    statutTournoi: "en_cours",
    statutMatch: "en_cours",
    demarreLe: "2026-10-03T20:00:00Z",
    nbParticipants: 2,
    unJoueurPret: false,
    aUnVerdict: false,
  };

  it("ouvert pendant 10 minutes après l'ouverture du match", () => {
    expect(pronosticOuvert(base, new Date("2026-10-03T20:09:00Z"))).toBe(true);
    expect(pronosticOuvert(base, new Date("2026-10-03T20:11:00Z"))).toBe(false);
  });

  it("fermé dès qu'un joueur est prêt, ou sans adversaires connus", () => {
    const t = new Date("2026-10-03T20:01:00Z");
    expect(pronosticOuvert({ ...base, unJoueurPret: true }, t)).toBe(false);
    expect(pronosticOuvert({ ...base, nbParticipants: 1 }, t)).toBe(false);
    expect(pronosticOuvert({ ...base, aUnVerdict: true }, t)).toBe(false);
    expect(pronosticOuvert({ ...base, demarreLe: null, statutMatch: "en_attente" }, t)).toBe(true);
  });
});

describe("partsPronostics", () => {
  it("arrondit à une somme de 100", () => {
    expect(partsPronostics(1, 2)).toEqual([33, 67]);
    expect(partsPronostics(0, 0)).toEqual([0, 0]);
  });
});

describe("issuePronostic", () => {
  it("ne compte qu'un résultat lu chez Riot", () => {
    expect(issuePronostic("a", null)).toBe("en_attente");
    expect(issuePronostic("a", { niveau: "historique", gagnantId: "a" })).toBe("juste");
    expect(issuePronostic("a", { niveau: "code_tournoi", gagnantId: "b" })).toBe("faux");
    expect(issuePronostic("a", { niveau: "manuel", gagnantId: "a" })).toBe("annule");
  });
});
