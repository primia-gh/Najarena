import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  capaciteEffective,
  heureParis,
  instantParis,
  jourParis,
  nomTournoi,
  slugTournoi,
  CRENEAUX,
} from "./creneaux";

describe("instantParis", () => {
  it("heure d'été : 21:00 à Paris = 19:00 UTC", () => {
    expect(instantParis("2026-09-24", "21:00").toISOString()).toBe("2026-09-24T19:00:00.000Z");
  });

  it("heure d'hiver : 21:00 à Paris = 20:00 UTC", () => {
    expect(instantParis("2026-12-10", "21:00").toISOString()).toBe("2026-12-10T20:00:00.000Z");
  });

  it("jour du passage à l'heure d'hiver (25/10/2026) : le soir est déjà en heure d'hiver", () => {
    expect(instantParis("2026-10-25", "21:00").toISOString()).toBe("2026-10-25T20:00:00.000Z");
  });

  it("jour du passage à l'heure d'été (29/03/2026) : le soir est déjà en heure d'été", () => {
    expect(instantParis("2026-03-29", "21:00").toISOString()).toBe("2026-03-29T19:00:00.000Z");
  });

  it("minuit et quart, avant le changement d'heure de la nuit", () => {
    expect(instantParis("2026-10-25", "00:15").toISOString()).toBe("2026-10-24T22:15:00.000Z");
  });
});

describe("jourParis", () => {
  it("23:30 UTC en été est déjà le lendemain à Paris", () => {
    expect(jourParis(new Date("2026-09-24T23:30:00Z"))).toBe("2026-09-25");
  });

  it("21:59 UTC en été = 23:59 à Paris, encore le même jour", () => {
    expect(jourParis(new Date("2026-09-24T21:59:00Z"))).toBe("2026-09-24");
  });
});

describe("ajouterJours", () => {
  it("passe les fins de mois et d'année", () => {
    expect(ajouterJours("2026-09-30", 1)).toBe("2026-10-01");
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("heureParis", () => {
  it("affiche l'heure de Paris, pas celle du serveur", () => {
    expect(heureParis("2026-09-24T19:00:00.000Z")).toBe("21:00");
    expect(heureParis("2026-12-10T20:00:00.000Z")).toBe("21:00");
  });
});

describe("nom et adresse du tournoi", () => {
  const creneau = CRENEAUX[0];

  it("nom daté, lisible", () => {
    expect(nomTournoi(creneau, "2026-09-25")).toBe(`${creneau.nom} · 25/09`);
  });

  it("adresse unique par créneau et par jour", () => {
    expect(slugTournoi(creneau, "2026-09-25")).toBe(`najarena-${creneau.cle}-2026-09-25`);
  });

  it("le nom respecte la limite de 3 à 60 caractères des tournois", () => {
    for (const c of CRENEAUX) {
      const nom = nomTournoi(c, "2026-09-25");
      expect(nom.length).toBeGreaterThanOrEqual(3);
      expect(nom.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("capaciteEffective", () => {
  it.each([
    [2, 16, 4],
    [4, 16, 4],
    [5, 16, 8],
    [8, 16, 8],
    [9, 16, 16],
    [16, 16, 16],
    [20, 16, 16],
  ])("%i joueurs, %i places annoncées → bracket de %i", (joueurs, annoncee, attendu) => {
    expect(capaciteEffective(joueurs, annoncee)).toBe(attendu);
  });

  it("toujours une capacité autorisée par la base (4 à 128, puissance de 2)", () => {
    for (let n = 0; n <= 70; n++) {
      expect([4, 8, 16, 32, 64]).toContain(capaciteEffective(n, 64));
    }
  });
});
