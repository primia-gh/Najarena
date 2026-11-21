import { describe, expect, it } from "vitest";
import type { Bilan } from "./bilan";
import { construireDemandeProgression, progressionMesurable, validerProgression } from "./progression-ia";

function bilan(champs: Partial<Bilan> = {}): Bilan {
  return {
    format: "1v1",
    parties: 14,
    victoires: 8,
    premiere: "2026-10-01T18:00:00Z",
    derniere: "2026-11-15T21:00:00Z",
    championPrincipal: null,
    postePrincipal: null,
    partiesComparees: 14,
    partiesManquantes: 0,
    comparaison: "vainqueurs",
    partiesRepere: 120,
    forces: [
      { indicateur: "premier_sang", valeur: 0.6, repere: 0.45, source: "vainqueurs", partiesJoueur: 14, partiesRepere: 120, fiabilite: "indicatif" },
    ],
    axes: [
      { indicateur: "morts_10min", valeur: 2.4, repere: 1.6, source: "vainqueurs", partiesJoueur: 14, partiesRepere: 120, fiabilite: "indicatif" },
    ],
    auNiveau: [],
    progression: [
      { indicateur: "sbires_min", points: [], recente: 7.1, precedente: 6.2, tendance: "progres", repere: 7.4 },
      { indicateur: "or_min", points: [], recente: 420, precedente: 380, tendance: "progres", repere: 430 },
      { indicateur: "kda", points: [], recente: 3.1, precedente: 2.2, tendance: "progres", repere: null },
    ],
    champions: [
      { champion: "Ahri", championId: 103, parties: 8, victoires: 5, kda: 3.4, sbiresMin: 7, apprentissage: "progres" },
    ],
    championLePlusSolide: null,
    plan: [{ indicateur: "morts_10min", cible: 1.6, actuel: 2.4, recent: 2.0, statut: "en_bonne_voie", source: "vainqueurs" }],
    ...champs,
  };
}

describe("progression mesurable", () => {
  it("demande 10 parties comparées et une tendance hors KDA et or", () => {
    expect(progressionMesurable(bilan())).toBe(true);
    expect(progressionMesurable(bilan({ partiesComparees: 9 }))).toBe(false);
    expect(progressionMesurable(bilan({ partiesManquantes: 2 }))).toBe(false);
    const sansTendance = bilan().progression.map((s) => (s.indicateur === "sbires_min" ? { ...s, tendance: null } : s));
    expect(progressionMesurable(bilan({ progression: sansTendance }))).toBe(false);
  });
});

describe("demande à l'IA", () => {
  const { systeme, contenu } = construireDemandeProgression(bilan());

  it("donne les chiffres du bilan entre balises, formatés comme sur la page", () => {
    expect(contenu.startsWith("<bilan>\n")).toBe(true);
    expect(contenu.endsWith("\n</bilan>")).toBe(true);
    expect(contenu).toContain("Sbires par minute : 6,2 puis 7,1 (progrès) ; vainqueurs : 7,4");
    expect(contenu).toContain("Morts par 10 minutes : 2,4 contre 1,6 (moyenne des vainqueurs), sur 14 parties (indicatif)");
    expect(contenu).toContain("Ahri : 8 parties, 5 victoires, évolution progrès");
    expect(contenu).toContain("cible 1,6, moyenne 2,4, 5 dernières parties 2,0 (en bonne voie)");
  });

  it("ne transmet jamais le KDA ni l'or par minute", () => {
    expect(contenu).not.toMatch(/KDA|Or par minute|3,4/);
    expect(systeme).toMatch(/Ne parle jamais du KDA/);
  });
});

describe("réponse de l'IA", () => {
  const valide = {
    resume: "Tu progresses aux sbires.",
    progres: ["Sbires par minute : 6,2 puis 7,1."],
    reculs: [],
    priorites: ["Vise 1,6 mort par 10 minutes."],
  };

  it("accepte une réponse bien formée", () => {
    expect(validerProgression(valide)).toEqual(valide);
  });

  it("refuse une réponse sans priorité, trop longue ou qui parle du KDA", () => {
    expect(validerProgression({ ...valide, priorites: [] })).toBeNull();
    expect(validerProgression({ ...valide, resume: "x".repeat(701) })).toBeNull();
    expect(validerProgression({ ...valide, progres: ["a", "b", "c", "d"] })).toBeNull();
    expect(validerProgression({ ...valide, reculs: ["Ton KDA baisse."] })).toBeNull();
    expect(validerProgression({ ...valide, resume: "Un K/D/A de 3." })).toBeNull();
    expect(validerProgression(null)).toBeNull();
  });
});
