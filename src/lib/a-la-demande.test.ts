import { describe, expect, it } from "vitest";
import { estOfficiel, heuresProposees, messageRefusDisponibilite } from "./a-la-demande";

describe("heuresProposees", () => {
  it("propose des heures pleines de 12 h à 23 h (Paris), de 90 minutes à 3 jours à l'avance", () => {
    // Jeudi 8 octobre 2026, 18 h 40 à Paris (16 h 40 UTC, heure d'été).
    const jours = heuresProposees(new Date("2026-10-08T16:40:00Z"));
    expect(jours[0]).toEqual({
      jour: "2026-10-08",
      // 20 h serait dans 80 minutes : trop tôt.
      heures: [
        { debut: "2026-10-08T19:00:00.000Z", heure: "21:00" },
        { debut: "2026-10-08T20:00:00.000Z", heure: "22:00" },
        { debut: "2026-10-08T21:00:00.000Z", heure: "23:00" },
      ],
    });
    expect(jours.map((j) => j.jour)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(jours[1].heures).toHaveLength(12);
    // Dimanche 11 : jusqu'à 18 h, 72 h après jeudi 18 h 40.
    expect(jours[3].heures.at(-1)?.heure).toBe("18:00");
  });

  it("suit le passage à l'heure d'hiver", () => {
    // Samedi 24 octobre 2026, 22 h à Paris ; dimanche 25, on passe à UTC+1.
    const jours = heuresProposees(new Date("2026-10-24T20:00:00Z"));
    const dimanche = jours.find((j) => j.jour === "2026-10-25");
    expect(dimanche?.heures[0]).toEqual({ debut: "2026-10-25T11:00:00.000Z", heure: "12:00" });
  });
});

describe("estOfficiel", () => {
  it("le quotidien est officiel, pas un tournoi à la demande ni d'organisateur", () => {
    expect(estOfficiel("quotidien-21h")).toBe(true);
    expect(estOfficiel("a-la-demande")).toBe(false);
    expect(estOfficiel(null)).toBe(false);
  });
});

describe("messageRefusDisponibilite", () => {
  it("traduit les refus de la base", () => {
    expect(messageRefusDisponibilite("HEURE_INVALIDE")).toContain("heure pleine");
    expect(messageRefusDisponibilite("TOURNOI_DEJA_PREVU")).toContain("inscris-toi");
    expect(messageRefusDisponibilite("autre")).toContain("Impossible");
  });
});
