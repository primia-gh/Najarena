import { describe, expect, it } from "vitest";
import {
  choisirFormat,
  construireBilan,
  construireBuild,
  detailConstat,
  formaterIndicateur,
  partieDepuisLigne,
  postePrincipal,
  repereDepuisLigne,
  tauxPrudent,
  type CleIndicateur,
  type PartieBilan,
  type Repere,
} from "./bilan";

let numero = 0;

/** Une partie vérifiée d'exemple ; les parties créées ensuite sont plus récentes. */
function partie(
  options: Partial<Omit<PartieBilan, "valeurs">> & { v?: Partial<Record<CleIndicateur, number>> } = {},
): PartieBilan {
  numero += 1;
  const { v, ...reste } = options;
  return {
    matchId: `m${numero}`,
    format: "1v1",
    champion: "Ahri",
    championId: 103,
    poste: null,
    gagne: true,
    joueLe: new Date(Date.UTC(2026, 8, 1) + numero * 3_600_000).toISOString(),
    kills: 3,
    deaths: 1,
    assists: 2,
    valeurs: { ...v },
    objets: [],
    runePrincipale: null,
    styleSecondaire: null,
    sorts: [],
    ...reste,
  };
}

function repere(indicateur: CleIndicateur, parties: number, mg: number, eg: number, mp: number, ep: number): Repere {
  return { indicateur, parties, moyenneGagnants: mg, ecartGagnants: eg, moyennePerdants: mp, ecartPerdants: ep };
}

describe("affichage", () => {
  it("formate chaque indicateur à la française", () => {
    expect(formaterIndicateur("kda", 3.456)).toBe("3,46");
    expect(formaterIndicateur("sbires_min", 7.84)).toBe("7,8");
    expect(formaterIndicateur("premier_sang", 0.625)).toBe("63 %");
    expect(formaterIndicateur("degats_min", 1204.4).replace(/\s/g, " ")).toBe("1 204");
  });

  it("choisit le format demandé s'il a des parties, sinon le plus joué", () => {
    const parties = [partie(), partie(), partie({ format: "5v5" })];
    expect(choisirFormat(parties)).toBe("1v1");
    expect(choisirFormat(parties, "5v5")).toBe("5v5");
    expect(choisirFormat([partie()], "5v5")).toBe("1v1");
    expect(choisirFormat([], "n'importe quoi")).toBe("1v1");
  });

  it("borne basse de Wilson : 3 sur 3 passe devant 3 sur 4", () => {
    expect(tauxPrudent(0, 0)).toBe(0);
    expect(tauxPrudent(3, 3)).toBeCloseTo(0.75, 5);
    expect(tauxPrudent(3, 4)).toBeCloseTo(0.5, 5);
  });
});

describe("construireBilan", () => {
  it("attend 5 parties vérifiées avant de tirer une conclusion", () => {
    const bilan = construireBilan([partie({ v: { sbires_min: 6 } }), partie({ gagne: false })], "1v1", []);
    expect(bilan.parties).toBe(2);
    expect(bilan.partiesManquantes).toBe(3);
    expect(bilan.forces).toEqual([]);
    expect(bilan.axes).toEqual([]);
    expect(bilan.progression).toEqual([]);
    expect(bilan.comparaison).toBeNull();
    expect(bilan.champions).toHaveLength(1);
  });

  it("compare aux vainqueurs : forces, axes classés par poids, indicateurs au niveau", () => {
    const sbires = [4, 4, 4, 5, 5.5, 6, 6, 6.5];
    const parties = sbires.map((s, i) =>
      partie({ gagne: i % 2 === 0, v: { sbires_min: s, morts_10min: 1, degats_min: 710, sbires_10: 50, premier_sang: 1 } }),
    );
    const reperes = [
      repere("sbires_min", 40, 7, 1, 6, 1),
      repere("morts_10min", 40, 1.5, 0.5, 2.5, 0.5),
      repere("degats_min", 40, 700, 100, 650, 100),
      repere("sbires_10", 40, 60, 8, 59, 8),
      repere("premier_sang", 10, 0.9, 0.3, 0.2, 0.4), // trop peu de parties
      repere("kda", 40, 4, 1, 2, 1), // suit l'issue de la partie : jamais un conseil
    ];
    const bilan = construireBilan(parties, "1v1", reperes);
    expect(bilan.comparaison).toBe("vainqueurs");
    expect(bilan.partiesRepere).toBe(40);
    expect(bilan.forces.map((f) => f.indicateur)).toEqual(["morts_10min"]);
    expect(bilan.axes.map((a) => a.indicateur)).toEqual(["sbires_min", "sbires_10"]);
    expect(bilan.auNiveau).toEqual(["degats_min"]);
    expect(bilan.axes[0]).toMatchObject({ valeur: 5.125, repere: 7, source: "vainqueurs", partiesJoueur: 8, fiabilite: "indicatif" });
    expect(detailConstat(bilan.axes[0])).toBe("5,1 en moyenne, contre 7,0 pour les vainqueurs.");
    expect(detailConstat(bilan.forces[0])).toBe("1,0 en moyenne, contre 1,5 pour les vainqueurs.");
    expect(detailConstat({ ...bilan.axes[0], indicateur: "premier_sang", valeur: 0.42, repere: 0.62 })).toBe(
      "Dans 42 % de tes parties, contre 62 % pour les vainqueurs.",
    );
    // Plan : les 5 dernières parties (5,8 sbires/min) progressent vers 7 ; les sbires à 10 minutes stagnent.
    expect(bilan.plan.map((o) => [o.indicateur, o.statut])).toEqual([
      ["sbires_min", "en_bonne_voie"],
      ["sbires_10", "a_travailler"],
    ]);
    expect(bilan.plan[0].recent).toBeCloseTo(5.8, 5);
    expect(bilan.progression.find((s) => s.indicateur === "sbires_min")?.repere).toBe(7);
    expect(bilan.progression.find((s) => s.indicateur === "premier_sang")?.repere).toBeNull();
  });

  it("sans repère, compare tes victoires à tes défaites", () => {
    const parties = [
      ...[1, 2, 3, 4].map(() => partie({ gagne: true, v: { sbires_min: 7, morts_10min: 1 } })),
      ...[1, 2, 3, 4].map(() => partie({ gagne: false, v: { sbires_min: 5, morts_10min: 1 } })),
    ];
    const bilan = construireBilan(parties, "1v1", []);
    expect(bilan.comparaison).toBe("tes_parties");
    expect(bilan.axes).toHaveLength(1);
    expect(bilan.axes[0]).toMatchObject({ indicateur: "sbires_min", valeur: 6, repere: 7, valeurDefaites: 5, source: "tes_victoires" });
    expect(detailConstat(bilan.axes[0])).toBe("7,0 dans tes victoires, 5,0 dans tes défaites.");
    expect(bilan.forces).toEqual([]); // moins de 10 parties : pas encore de progrès mesurable
  });

  it("sans repère, montre tes progrès : 5 dernières parties contre les précédentes", () => {
    const parties = [40, 40, 40, 40, 40, 60, 60, 60, 60, 60].map((s) => partie({ v: { sbires_10: s } }));
    const bilan = construireBilan(parties, "1v1", []);
    expect(bilan.comparaison).toBe("tes_parties");
    expect(bilan.forces[0]).toMatchObject({ indicateur: "sbires_10", valeur: 60, repere: 40, source: "toi_avant" });
    expect(detailConstat(bilan.forces[0])).toBe("60 sur tes 5 dernières parties, contre 40 avant.");
    const serie = bilan.progression.find((s) => s.indicateur === "sbires_10");
    expect(serie).toMatchObject({ recente: 60, precedente: 40, tendance: "progres" });
    expect(serie?.points).toHaveLength(10);
    expect(serie?.points[3].moyenne).toBeNull(); // pas encore 5 parties
    expect(serie?.points[4].moyenne).toBe(40);
    expect(serie?.points[9].moyenne).toBe(60);
  });

  it("5v5 : compare les parties du poste principal, et seulement s'il est connu", () => {
    const milieu = [6, 6, 6, 6, 6, 6].map((s, i) => partie({ format: "5v5", poste: "MIDDLE", gagne: i < 3, v: { sbires_min: s } }));
    const support = [1, 1].map((s) => partie({ format: "5v5", poste: "UTILITY", v: { sbires_min: s } }));
    const reperes = [repere("sbires_min", 60, 8, 1, 7, 1)];
    const bilan = construireBilan([...milieu, ...support], "5v5", reperes);
    expect(bilan.postePrincipal).toBe("MIDDLE");
    expect(bilan.parties).toBe(8);
    expect(bilan.partiesComparees).toBe(6);
    expect(bilan.axes[0]).toMatchObject({ indicateur: "sbires_min", valeur: 6, repere: 8 });

    const sansPoste = construireBilan(milieu.map((p) => ({ ...p, poste: null })), "5v5", reperes);
    expect(sansPoste.postePrincipal).toBeNull();
    expect(sansPoste.comparaison).not.toBe("vainqueurs");

    // Moins de 5 parties au poste le plus joué : toutes les parties, sans repère.
    const melange = construireBilan([...milieu.slice(0, 4), ...support, partie({ format: "5v5", poste: null })], "5v5", reperes);
    expect(melange.postePrincipal).toBeNull();
    expect(melange.partiesComparees).toBe(7);
    expect(melange.comparaison).not.toBe("vainqueurs");
    expect(postePrincipal([partie({ poste: "TOP" }), partie({ poste: "JUNGLE" }), partie({ poste: "JUNGLE" })])).toBe("JUNGLE");
  });

  it("n'écrit jamais le KDA ni l'or comme axe de travail", () => {
    const parties = [
      ...[1, 2, 3].map(() => partie({ gagne: true, v: { kda: 6, or_min: 450 } })),
      ...[1, 2, 3].map(() => partie({ gagne: false, v: { kda: 1, or_min: 300 } })),
    ];
    const bilan = construireBilan(parties, "1v1", [repere("kda", 50, 5, 1, 2, 1), repere("or_min", 50, 450, 30, 350, 30)]);
    expect(bilan.axes).toEqual([]);
    expect(bilan.forces).toEqual([]);
    expect(bilan.comparaison).toBeNull();
  });

  it("champions : le plus joué, le plus solide, et l'apprentissage sur 6 parties", () => {
    const parties = [
      ...[true, true, true, false].map((gagne) => partie({ champion: "Ahri", gagne })),
      ...[true, true, true].map((gagne) => partie({ champion: "Zed", championId: 238, gagne })),
      partie({ champion: "Lux", championId: 99, gagne: true }),
      ...[false, false, false, true, true, true].map((gagne) => partie({ champion: "Garen", championId: 86, gagne })),
    ];
    const bilan = construireBilan(parties, "1v1", []);
    expect(bilan.championPrincipal).toEqual({ champion: "Garen", championId: 86, parties: 6 });
    expect(bilan.championLePlusSolide?.champion).toBe("Zed");
    expect(bilan.champions.find((c) => c.champion === "Garen")?.apprentissage).toBe("progres");
    expect(bilan.champions.find((c) => c.champion === "Ahri")?.apprentissage).toBeNull();
    expect(bilan.champions.find((c) => c.champion === "Ahri")?.kda).toBe(5); // (3 + 2) × 4 / 4 morts
  });
});

describe("construireBuild", () => {
  const potion = 2003;
  const estObjetDeBuild = (o: number) => o !== potion;
  const parties = [
    partie({ champion: "Ahri", objets: [6655, 3020, potion], runePrincipale: 8112, sorts: [14, 4] }),
    partie({ champion: "Ahri", objets: [6655, 3020, 6655], runePrincipale: 8112, sorts: [4, 14], gagne: false }),
    partie({ champion: "Ahri", objets: [6655, 0], runePrincipale: 8112, sorts: [4, 14] }),
    partie({ champion: "Ahri", objets: [6655], runePrincipale: 8229, sorts: [4, 14] }),
    partie({ champion: "Zed", objets: [3142] }),
  ];
  const reference = [
    { genre: "total", valeur: null, parties: 20, victoires: 12 },
    { genre: "objet", valeur: "6655", parties: 15, victoires: 10 },
    { genre: "objet", valeur: "3020", parties: 10, victoires: 6 },
    { genre: "objet", valeur: "3157", parties: 9, victoires: 7 },
    { genre: "objet", valeur: String(potion), parties: 20, victoires: 12 },
    { genre: "rune", valeur: "8112", parties: 8, victoires: 5 },
    { genre: "rune", valeur: "8229", parties: 12, victoires: 7 },
    { genre: "sorts", valeur: "4,14", parties: 18, victoires: 11 },
  ];

  it("décrit le build du joueur : objets une fois par partie, sans consommable", () => {
    const build = construireBuild(parties, "Ahri", [], estObjetDeBuild);
    expect(build.parties).toBe(4);
    expect(build.victoires).toBe(3);
    expect(build.joueur.objets.map((o) => [o.valeur, o.parties, o.victoires])).toEqual([
      ["6655", 4, 3],
      ["3020", 2, 1],
    ]);
    expect(build.joueur.runes.map((r) => [r.valeur, r.part])).toEqual([
      ["8112", 0.75],
      ["8229", 0.25],
    ]);
    expect(build.joueur.sorts).toEqual([{ valeur: "4,14", parties: 4, victoires: 3, part: 1 }]);
    expect(build.reference).toBeNull(); // moins de 10 parties de référence
    expect(build.aEssayer).toEqual([]);
  });

  it("compare aux vainqueurs et propose ce qu'ils prennent souvent et le joueur rarement", () => {
    const build = construireBuild(parties, "Ahri", reference, estObjetDeBuild);
    expect(build.reference?.objets.map((o) => o.valeur)).toEqual(["6655", "3157", "3020"]);
    expect(build.reference?.runes.map((r) => r.valeur)).toEqual(["8229", "8112"]);
    expect(build.reference?.sorts[0]).toMatchObject({ valeur: "4,14", victoires: 11 });
    expect(build.aEssayer).toEqual([{ genre: "objet", valeur: "3157", partVainqueurs: 7 / 12, partJoueur: 0 }]);
  });
});

describe("lecture de la base", () => {
  it("convertit une ligne de la vue (nombres reçus en texte)", () => {
    const ligne = {
      match_id: "m",
      format: "5v5",
      champion: "Ahri",
      champion_id: 103,
      poste: "MIDDLE",
      gagne: true,
      joue_le: "2026-10-01T20:00:00Z",
      kills: 5,
      deaths: 2,
      assists: 7,
      kda: "6.00",
      sbires_min: "8.40",
      sbires_10: 71,
      morts_10min: "0.80",
      degats_min: "840.0",
      or_min: "440.0",
      vision_min: "1.10",
      part_kills: "0.600",
      part_degats: "0.280",
      premier_sang: 0,
      objets: [6655],
      rune_principale: 8112,
      style_secondaire: 8300,
      sorts: [4, 12],
    };
    const p = partieDepuisLigne(ligne);
    expect(p?.valeurs).toMatchObject({ kda: 6, sbires_min: 8.4, sbires_10: 71, part_kills: 0.6, premier_sang: 0 });
    expect(p?.sorts).toEqual([4, 12]);
    expect(partieDepuisLigne({ ...ligne, format: "2v2" })).toBeNull();
  });

  it("ignore un repère que le bilan ne suit pas", () => {
    const ligne = { parties: 40, moyenne_gagnants: "1.000", ecart_gagnants: "0", moyenne_perdants: "0", ecart_perdants: "0" };
    expect(repereDepuisLigne({ indicateur: "premiere_tour", ...ligne })).toBeNull();
    expect(repereDepuisLigne({ indicateur: "toString", ...ligne })).toBeNull();
    expect(repereDepuisLigne({ indicateur: "premier_sang", ...ligne })).toMatchObject({ moyenneGagnants: 1, parties: 40 });
  });
});
