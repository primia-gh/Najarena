import { describe, expect, it } from "vitest";
import {
  deciderSerie,
  defaiteReconnueATrancher,
  delaiAvantLitigeMinutes,
  doitChercher,
  doitPasserEnLitige,
  victoiresNecessaires,
  type PartieSerie,
} from "./serie";

function partie(id: string, debutMinutes: number, gagnantEstA: boolean): PartieSerie {
  return { riotMatchId: id, debut: debutMinutes * 60_000, gagnantEstA };
}

describe("victoiresNecessaires", () => {
  it("Bo1 : 1, Bo3 : 2, Bo5 : 3", () => {
    expect(victoiresNecessaires(1)).toBe(1);
    expect(victoiresNecessaires(3)).toBe(2);
    expect(victoiresNecessaires(5)).toBe(3);
  });
});

describe("deciderSerie", () => {
  it("Bo1 : la première partie décide", () => {
    const serie = deciderSerie([partie("a", 10, false)], 1);
    expect(serie?.gagnantEstA).toBe(false);
    expect(serie?.parties.map((p) => p.riotMatchId)).toEqual(["a"]);
  });

  it("Bo3 : gagner la première manche ne suffit pas (bug d'avant le 28/09/2026)", () => {
    expect(deciderSerie([partie("m1", 10, true)], 3)).toBeNull();
  });

  it("Bo3 : 1-1 reste en attente, jamais de résultat inventé", () => {
    expect(deciderSerie([partie("m1", 10, true), partie("m2", 40, false)], 3)).toBeNull();
  });

  it("Bo3 : perdre la 1re manche puis gagner les deux suivantes", () => {
    const serie = deciderSerie([partie("m1", 10, true), partie("m2", 40, false), partie("m3", 70, false)], 3);
    expect(serie?.gagnantEstA).toBe(false);
    expect(serie?.parties.map((p) => p.riotMatchId)).toEqual(["m1", "m2", "m3"]);
  });

  it("Bo3 : les parties arrivent dans le désordre (historique Riot du plus récent au plus ancien)", () => {
    const serie = deciderSerie([partie("m2", 40, true), partie("m1", 10, true)], 3);
    expect(serie?.gagnantEstA).toBe(true);
    expect(serie?.parties.map((p) => p.riotMatchId)).toEqual(["m1", "m2"]);
  });

  it("une partie jouée après la manche décisive est ignorée", () => {
    const serie = deciderSerie([partie("m1", 10, true), partie("m2", 40, true), partie("amical", 70, false)], 3);
    expect(serie?.gagnantEstA).toBe(true);
    expect(serie?.parties).toHaveLength(2);
  });

  it("aucune partie : rien à décider", () => {
    expect(deciderSerie([], 1)).toBeNull();
  });
});

describe("calendrier de recherche", () => {
  it("litige après 60 min en Bo1, 120 en Bo3, 180 en Bo5", () => {
    expect(delaiAvantLitigeMinutes(1)).toBe(60);
    expect(delaiAvantLitigeMinutes(3)).toBe(120);
    expect(delaiAvantLitigeMinutes(5)).toBe(180);
    expect(doitPasserEnLitige(59, 1)).toBe(false);
    expect(doitPasserEnLitige(60, 1)).toBe(true);
    expect(doitPasserEnLitige(100, 3)).toBe(false);
  });

  it("pas de recherche avant T+8 min", () => {
    expect(doitChercher("en_cours", 7.9)).toBe(false);
    expect(doitChercher("en_cours", 8)).toBe(true);
  });

  it("en litige : environ une recherche toutes les 30 min, pendant 24 h", () => {
    const passages = Array.from({ length: 12 }, (_, i) => 60 + i * 5).filter((age) => doitChercher("litige", age));
    expect(passages).toEqual([60, 90]);
    expect(doitChercher("litige", 24 * 60 + 1)).toBe(false);
  });

  it("défaite reconnue : tranchée après 20 min sans confirmation Riot", () => {
    expect(defaiteReconnueATrancher(19)).toBe(false);
    expect(defaiteReconnueATrancher(20)).toBe(true);
  });
});
