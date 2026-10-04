import { describe, expect, it } from "vitest";
import { datePossible, etatScrim, resultatScrim } from "./scrims";

const MAINTENANT = new Date("2026-10-03T18:00:00Z");

describe("scrims", () => {
  it("suit l'état d'un scrim, de la proposition au résultat", () => {
    const demain = "2026-10-04T19:00:00Z";
    const hier = "2026-10-02T19:00:00Z";
    expect(etatScrim({ statut: "propose", prevuLe: demain }, MAINTENANT)).toBe("propose");
    expect(etatScrim({ statut: "propose", prevuLe: hier }, MAINTENANT)).toBe("expire");
    expect(etatScrim({ statut: "accepte", prevuLe: demain, statutTournoi: "en_cours" }, MAINTENANT)).toBe("a_venir");
    expect(etatScrim({ statut: "accepte", prevuLe: hier, statutTournoi: "en_cours" }, MAINTENANT)).toBe("a_jouer");
    expect(etatScrim({ statut: "accepte", prevuLe: hier, statutTournoi: "termine" }, MAINTENANT)).toBe("joue");
    expect(etatScrim({ statut: "accepte", prevuLe: hier, statutTournoi: "annule" }, MAINTENANT)).toBe("annule");
    expect(etatScrim({ statut: "refuse", prevuLe: demain }, MAINTENANT)).toBe("refuse");
  });

  it("ne dit « vérifiée » que pour un résultat lu chez Riot", () => {
    expect(resultatScrim(true, "historique")).toBe("Victoire vérifiée");
    expect(resultatScrim(false, "code_tournoi")).toBe("Défaite vérifiée");
    expect(resultatScrim(false, "manuel")).toBe("Défaite reconnue");
    expect(resultatScrim(null, null)).toBe("Sans résultat");
  });

  it("borne la date proposée : 15 minutes à 30 jours", () => {
    expect(datePossible(new Date("2026-10-03T18:10:00Z"), MAINTENANT)).toBe(false);
    expect(datePossible(new Date("2026-10-03T19:00:00Z"), MAINTENANT)).toBe(true);
    expect(datePossible(new Date("2026-11-10T19:00:00Z"), MAINTENANT)).toBe(false);
  });
});
