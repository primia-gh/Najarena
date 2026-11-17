import { describe, expect, it } from "vitest";
import { heureDeParis, hygieneDeJeu, type PartieHorodatee } from "./hygiene-jeu";

describe("hygieneDeJeu", () => {
  it("dix sessions de 4 parties : victoire puis trois défaites — règle d'arrêt après 2 défaites et après 3 parties", () => {
    const parties: PartieHorodatee[] = [];
    for (let jour = 0; jour < 10; jour += 1) {
      for (let rang = 0; rang < 4; rang += 1) {
        // 20 h à Paris, 30 minutes de jeu, 5 minutes entre deux parties.
        const debut = Date.UTC(2026, 8, 2 + jour, 18, rang * 35);
        parties.push({ joueLe: new Date(debut).toISOString(), dureeSecondes: 1800, gagne: rang === 0 });
      }
    }
    const h = hygieneDeJeu(parties);
    expect(h).toMatchObject({ parties: 40, victoires: 10, taux: 0.25, sessions: 10, partiesParSession: 4 });
    expect(h?.apresDefaites.map((s) => [s.cle, s.parties, s.victoires])).toEqual([
      ["0", 20, 10],
      ["1", 10, 0],
      ["2+", 10, 0],
    ]);
    expect(h?.rangDansSession.map((s) => [s.cle, s.parties])).toEqual([
      ["1-2", 20],
      ["3", 10],
      ["4+", 10],
    ]);
    expect(h?.momentDeJournee.find((s) => s.cle === "soir")?.parties).toBe(40);
    expect(h?.regles.map((r) => r.texte)).toEqual([
      "Après 2 défaites d'affilée, tu gagnes 0 % de tes parties (sur 10), contre 25 % en général : arrête-toi après 2 défaites.",
      "À partir de la 4e partie d'affilée, tu gagnes 0 % de tes parties (sur 10), contre 25 % en général : limite tes sessions à 3 parties.",
    ]);
  });

  it("la nuit coûte des victoires : règle sur le moment de la journée", () => {
    const parties: PartieHorodatee[] = [];
    for (let jour = 0; jour < 20; jour += 1) {
      parties.push({ joueLe: new Date(Date.UTC(2026, 8, 1 + jour, 15)).toISOString(), dureeSecondes: 1800, gagne: jour < 12 });
    }
    for (let jour = 0; jour < 12; jour += 1) {
      parties.push({ joueLe: new Date(Date.UTC(2026, 9, 1 + jour, 22, 30)).toISOString(), dureeSecondes: 1800, gagne: jour < 2 });
    }
    const h = hygieneDeJeu(parties);
    expect(h?.regles.map((r) => r.situation.cle)).toEqual(["nuit"]);
    expect(h?.regles[0].texte).toMatch(/^La nuit \(après 23 h\), tu gagnes 17 % de tes parties \(sur 12\)/);
  });

  it("rien sous 20 parties ; heure de Paris", () => {
    expect(hygieneDeJeu([{ joueLe: "2026-10-01T18:00:00Z", dureeSecondes: 1800, gagne: true }])).toBeNull();
    expect(heureDeParis("2026-10-01T18:00:00Z")).toBe(20);
    expect(heureDeParis("2026-12-01T18:00:00Z")).toBe(19);
  });
});
