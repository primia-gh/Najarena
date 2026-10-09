import { describe, expect, it } from "vitest";
import { classementPoule, mouvementDe, ordreDepart, repartirPoules, semaineLigue, taillesPoules, type Inscrit } from "./divisions";

const inscrit = (id: string, rating: number | null, jour = 1): Inscrit => ({
  id,
  rating,
  inscritLe: `2026-10-${String(jour).padStart(2, "0")}T10:00:00Z`,
});

describe("taillesPoules", () => {
  it("poules de 4, ou de 3 pour tomber juste", () => {
    expect(taillesPoules(2)).toEqual([]);
    expect(taillesPoules(3)).toEqual([3]);
    expect(taillesPoules(4)).toEqual([4]);
    expect(taillesPoules(5)).toEqual([4]);
    expect(taillesPoules(6)).toEqual([3, 3]);
    expect(taillesPoules(7)).toEqual([4, 3]);
    expect(taillesPoules(10)).toEqual([4, 3, 3]);
    expect(taillesPoules(12)).toEqual([4, 4, 4]);
  });
});

describe("ordreDepart", () => {
  it("première ligue : par rating", () => {
    expect(ordreDepart([inscrit("a", 1500), inscrit("b", 1800), inscrit("c", null)], [])).toEqual(["b", "a", "c"]);
  });

  it("montées et descentes, puis nouveaux insérés selon leur rating", () => {
    const precedent = [
      { id: "a", niveau: 1, rang: 1, mouvement: "reste" as const },
      { id: "b", niveau: 1, rang: 2, mouvement: "reste" as const },
      { id: "c", niveau: 1, rang: 3, mouvement: "descend" as const },
      { id: "d", niveau: 2, rang: 1, mouvement: "monte" as const },
      { id: "e", niveau: 2, rang: 2, mouvement: "reste" as const },
      { id: "f", niveau: 2, rang: 3, mouvement: "reste" as const },
    ];
    const inscrits = [
      inscrit("a", 1900),
      inscrit("b", 1850),
      inscrit("c", 1800),
      inscrit("d", 1700),
      inscrit("e", 1600),
      inscrit("f", 1500),
      inscrit("n1", 1650),
      inscrit("n2", 1650, 2),
    ];
    // d monte (fin de poule 1), c descend (début de poule 2) ; n1 et n2 avant
    // le premier ancien plus faible (e, 1600), le premier inscrit d'abord.
    expect(ordreDepart(inscrits, precedent)).toEqual(["a", "b", "d", "c", "n1", "n2", "e", "f"]);
  });

  it("un ancien absent ce mois-ci est simplement ignoré", () => {
    expect(
      ordreDepart([inscrit("b", 1500), inscrit("c", 1400)], [
        { id: "a", niveau: 1, rang: 1, mouvement: "reste" },
        { id: "b", niveau: 1, rang: 2, mouvement: "reste" },
        { id: "c", niveau: 1, rang: 3, mouvement: "reste" },
      ]),
    ).toEqual(["b", "c"]);
  });
});

describe("repartirPoules", () => {
  it("avec 5 inscrits, le dernier inscrit attend le mois suivant", () => {
    const r = repartirPoules(
      [inscrit("a", 1500, 1), inscrit("b", 1600, 2), inscrit("c", 1700, 3), inscrit("d", 1800, 4), inscrit("e", 2000, 5)],
      [],
    );
    expect(r).toEqual({ poules: [["d", "c", "b", "a"]], enAttente: ["e"] });
  });

  it("7 inscrits : une poule de 4 et une de 3", () => {
    const r = repartirPoules(
      ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => inscrit(id, 2000 - i * 50)),
      [],
    );
    expect(r.poules).toEqual([["a", "b", "c", "d"], ["e", "f", "g"]]);
  });
});

describe("classementPoule", () => {
  const membres = [
    { id: "a", ordre: 1 },
    { id: "b", ordre: 2 },
    { id: "c", ordre: 3 },
  ];

  it("victoires, puis victoires lues chez Riot, puis confrontation directe", () => {
    const lignes = classementPoule(membres, [
      { joueurA: "a", joueurB: "c", gagnantId: "c", niveauVerdict: "historique" },
      { joueurA: "a", joueurB: "b", gagnantId: "a", niveauVerdict: "historique" },
      { joueurA: "b", joueurB: "c", gagnantId: "b", niveauVerdict: "manuel" },
    ]);
    // Une victoire chacun ; b n'a gagné que par forfait : dernier.
    // a et c à égalité (une victoire lue chez Riot) : c a battu a.
    expect(lignes.map((l) => l.id)).toEqual(["c", "a", "b"]);
    expect(lignes[2]).toEqual({ id: "b", joues: 2, victoires: 1, defaites: 1, victoiresVerifiees: 0 });
  });

  it("matchs non joués : ordre de départ", () => {
    expect(classementPoule(membres, []).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });
});

describe("mouvementDe", () => {
  it("le premier monte, le dernier descend, sauf aux extrémités", () => {
    expect(mouvementDe(1, 4, 1, 3)).toBe("reste");
    expect(mouvementDe(1, 4, 2, 3)).toBe("monte");
    expect(mouvementDe(4, 4, 2, 3)).toBe("descend");
    expect(mouvementDe(4, 4, 3, 3)).toBe("reste");
    expect(mouvementDe(2, 4, 2, 3)).toBe("reste");
  });
});

describe("semaineLigue", () => {
  it("semaines 1 à 4, 0 avant, 5 après", () => {
    const debut = "2026-11-01T23:00:00Z";
    expect(semaineLigue(debut, new Date("2026-11-01T22:00:00Z"))).toBe(0);
    expect(semaineLigue(debut, new Date("2026-11-02T10:00:00Z"))).toBe(1);
    expect(semaineLigue(debut, new Date("2026-11-09T10:00:00Z"))).toBe(2);
    expect(semaineLigue(debut, new Date("2026-11-29T22:00:00Z"))).toBe(4);
    expect(semaineLigue(debut, new Date("2026-12-01T10:00:00Z"))).toBe(5);
  });
});
