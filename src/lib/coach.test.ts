import { describe, expect, it } from "vitest";
import { formaterPoints, resumeCoach } from "./coach";

describe("resumeCoach", () => {
  it("ne mesure que les suivis acceptés d'au moins 3 tournois", () => {
    expect(
      resumeCoach([
        { statut: "actif", tournois: 5, points: 80 },
        { statut: "termine", tournois: 3, points: -20 },
        { statut: "actif", tournois: 2, points: 300 },
        { statut: "demande", tournois: 0, points: 0 },
      ]),
    ).toEqual({ suivis: 3, mesures: 2, enProgression: 1, medianePoints: 30 });
  });

  it("aucune mesure : pas de médiane", () => {
    expect(resumeCoach([{ statut: "actif", tournois: 1, points: 10 }]).medianePoints).toBeNull();
  });

  it("médiane d'un nombre impair de suivis", () => {
    expect(
      resumeCoach([
        { statut: "actif", tournois: 4, points: 10 },
        { statut: "actif", tournois: 4, points: 50 },
        { statut: "actif", tournois: 4, points: -5 },
      ]).medianePoints,
    ).toBe(10);
  });
});

describe("formaterPoints", () => {
  it("écrit toujours le signe", () => {
    expect(formaterPoints(42.4)).toBe("+42");
    expect(formaterPoints(-17)).toBe("−17");
    expect(formaterPoints(0)).toBe("0");
  });
});
