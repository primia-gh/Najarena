import { describe, expect, it } from "vitest";
import { formaterPoints, resumeCoach } from "./coach";

describe("resumeCoach", () => {
  it("ne mesure que les suivis acceptés d'au moins 3 tournois", () => {
    expect(
      resumeCoach([
        { eleve_id: "e1", statut: "actif", tournois: 5, points: 80 },
        { eleve_id: "e2", statut: "termine", tournois: 3, points: -20 },
        { eleve_id: "e3", statut: "actif", tournois: 2, points: 300 },
        { eleve_id: "e4", statut: "demande", tournois: 0, points: 0 },
      ]),
    ).toEqual({ suivis: 3, mesures: 2, enProgression: 1, medianePoints: null });
  });

  it("moins de 3 élèves mesurés : pas de médiane", () => {
    expect(resumeCoach([{ eleve_id: "e5", statut: "actif", tournois: 1, points: 10 }]).medianePoints).toBeNull();
    expect(
      resumeCoach([
        { eleve_id: "e6", statut: "actif", tournois: 4, points: 10 },
        { eleve_id: "e7", statut: "termine", tournois: 4, points: 50 },
      ]).medianePoints,
    ).toBeNull();
  });

  it("médiane d'un nombre impair de suivis", () => {
    expect(
      resumeCoach([
        { eleve_id: "e8", statut: "actif", tournois: 4, points: 10 },
        { eleve_id: "e9", statut: "actif", tournois: 4, points: 50 },
        { eleve_id: "e10", statut: "actif", tournois: 4, points: -5 },
      ]).medianePoints,
    ).toBe(10);
  });
});

describe("resumeCoach, élève suivi plusieurs fois", () => {
  it("compte l'élève une fois et additionne ses suivis", () => {
    expect(
      resumeCoach([
        { eleve_id: "a", statut: "termine", tournois: 2, points: 30 },
        { eleve_id: "a", statut: "actif", tournois: 2, points: 20 },
        { eleve_id: "b", statut: "actif", tournois: 1, points: 5 },
      ]),
    ).toEqual({ suivis: 2, mesures: 1, enProgression: 1, medianePoints: null });
  });
});

describe("formaterPoints", () => {
  it("écrit toujours le signe", () => {
    expect(formaterPoints(42.4)).toBe("+42");
    expect(formaterPoints(-17)).toBe("−17");
    expect(formaterPoints(0)).toBe("0");
  });
});
