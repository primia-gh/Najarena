import { describe, expect, it } from "vitest";
import type { PartieBilan } from "./bilan";
import { messageBilanHebdo, partiesDeLaSemaine } from "./bilan-hebdo";

let n = 0;
function partie(format: PartieBilan["format"], joueLe: string, gagne: boolean, valeurs: PartieBilan["valeurs"]): PartieBilan {
  n += 1;
  return {
    matchId: `m${n}`,
    format,
    champion: "Ahri",
    championId: 103,
    poste: "MIDDLE",
    gagne,
    joueLe,
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

// Semaine du lundi 28/09/2026 ; la semaine d'avant commence le 21/09.
const semaine = [
  partie("classees", "2026-09-28T18:00:00Z", true, { sbires_min: 7, morts_10min: 1, degats_min: 650 }),
  partie("classees", "2026-09-30T18:00:00Z", true, { sbires_min: 7.2, morts_10min: 1.2, degats_min: 640 }),
  partie("classees", "2026-10-02T18:00:00Z", false, { sbires_min: 6.8, morts_10min: 1.4, degats_min: 630 }),
  partie("1v1", "2026-10-03T19:00:00Z", true, { sbires_min: 9, morts_10min: 0, degats_min: 900 }),
];
const avant = [
  partie("classees", "2026-09-21T18:00:00Z", false, { sbires_min: 6.2, morts_10min: 2, degats_min: 640 }),
  partie("classees", "2026-09-23T18:00:00Z", true, { sbires_min: 6.1, morts_10min: 1.8, degats_min: 640 }),
  partie("classees", "2026-09-25T18:00:00Z", false, { sbires_min: 6.3, morts_10min: 1.9, degats_min: 640 }),
];

describe("bilan de la semaine", () => {
  it("garde les parties du lundi 00:00 au lundi suivant, heure de Paris", () => {
    const bord = partie("classees", "2026-09-27T22:30:00Z", true, {}); // lundi 28/09 à 0 h 30 à Paris
    expect(partiesDeLaSemaine([bord, ...avant], "2026-09-28")).toEqual([bord]);
  });

  it("parties de la semaine, trois indicateurs comparés dans le format le plus joué, règle d'arrêt, lien", () => {
    const message = messageBilanHebdo({
      lundi: "2026-09-28",
      parties: [...avant, ...semaine],
      regle: "Après 2 défaites d'affilée, tu gagnes 30 % de tes parties (sur 12), contre 52 % en général : arrête-toi après 2 défaites.",
      lien: "https://najarena.example/moi/bilan",
    });
    expect(message).toBe(
      [
        "📊 **Ton bilan de la semaine** (du 28/09 au 04/10)",
        "4 parties vérifiées (1 en tournoi, 3 en classée) · 3 victoires.",
        "Comparé à la semaine d'avant, en classée :",
        "↗ Sbires par minute : 7,0 (contre 6,2)",
        "↗ Morts par 10 minutes : 1,2 (contre 1,9)",
        "→ Dégâts aux champions par minute : 640 (contre 640)",
        "⏱️ Après 2 défaites d'affilée, tu gagnes 30 % de tes parties (sur 12), contre 52 % en général : arrête-toi après 2 défaites.",
        "Ton bilan complet : https://najarena.example/moi/bilan",
      ].join("\n"),
    );
  });

  it("rien sans partie dans la semaine ; pas de comparaison sous 3 parties de chaque côté", () => {
    expect(messageBilanHebdo({ lundi: "2026-10-05", parties: [...avant, ...semaine], regle: null, lien: "x" })).toBeNull();
    const message = messageBilanHebdo({ lundi: "2026-09-28", parties: semaine, regle: null, lien: "x" });
    expect(message).not.toMatch(/Comparé/);
    expect(message).not.toMatch(/⏱️/);
  });
});
