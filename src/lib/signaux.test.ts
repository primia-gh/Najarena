import { describe, expect, it } from "vitest";
import { detecterGroupesFermes, detecterSignaux, type MatchSignal } from "./signaux";

const match = (tournoiId: string, a: string, b: string, gagnant: string | null, verifie = true): MatchSignal => ({
  tournoiId,
  verifie,
  joueurs: [
    { id: a, gagnant: gagnant === null ? null : gagnant === a },
    { id: b, gagnant: gagnant === null ? null : gagnant === b },
  ],
});

describe("signaux à examiner", () => {
  it("repère deux joueurs qui se rencontrent souvent, dans un sens comme dans l'autre", () => {
    const matchs = [match("t1", "a", "b", "a"), match("t2", "b", "a", "a"), match("t3", "a", "b", "b"), match("t3", "c", "d", "c")];
    const { paires } = detecterSignaux(matchs, [], []);
    expect(paires).toEqual([{ a: "a", b: "b", matchs: 3, victoiresA: 2, victoiresB: 1 }]);
  });

  it("repère un organisateur qui joue dans son propre tournoi", () => {
    const { organisateursJoueurs } = detecterSignaux(
      [match("t1", "orga", "x", "orga"), match("t2", "y", "z", "y")],
      [
        { id: "t1", organisateurId: "orga", statut: "termine" },
        { id: "t2", organisateurId: "orga", statut: "termine" },
      ],
      [],
    );
    expect(organisateursJoueurs).toEqual([{ tournoiId: "t1", organisateurId: "orga" }]);
  });

  it("repère une hausse de rating anormale et un très petit tournoi qui compte", () => {
    const signaux = detecterSignaux(
      [match("t1", "a", "b", "a"), match("t1", "c", "d", "c"), match("t1", "a", "c", "a"), match("t2", "e", "f", "e", false)],
      [
        { id: "t1", organisateurId: "o", statut: "termine" },
        { id: "t2", organisateurId: "o", statut: "termine" },
      ],
      [
        { profileId: "a", tournoiId: "t1", avant: 1500, apres: 1690 },
        { profileId: "c", tournoiId: "t1", avant: 1500, apres: 1540 },
      ],
    );
    expect(signaux.hausses.map((h) => h.profileId)).toEqual(["a"]);
    // t2 n'a aucun match vérifié : il ne compte pas, pas de signal.
    expect(signaux.petitsTournois).toEqual([{ tournoiId: "t1", joueurs: 4 }]);
  });
});

describe("groupes fermés", () => {
  // Douze joueurs extérieurs qui se croisent une fois chacun : une activité normale.
  const exterieurs = Array.from({ length: 12 }, (_, i) =>
    match(`x${i}`, `e${i}`, `e${(i + 1) % 12}`, `e${i}`),
  );
  // Quatre joueurs qui ne jouent qu'entre eux, deux fois chaque paire.
  const paires = [["a", "b"], ["a", "c"], ["a", "d"], ["b", "c"], ["b", "d"], ["c", "d"]];
  const entreEux = paires.flatMap(([p, q], i) => [match(`g${i}`, p, q, p), match(`h${i}`, q, p, q)]);

  it("repère quatre joueurs qui ne jouent qu'entre eux", () => {
    expect(detecterGroupesFermes([...entreEux, ...exterieurs])).toEqual([
      { joueurs: ["a", "b", "c", "d"], matchsInternes: 12, part: 1 },
    ]);
  });

  it("ignore un groupe qui joue aussi beaucoup contre d'autres", () => {
    const ouverts = ["a", "b", "c", "d"].flatMap((j) =>
      [0, 1, 2, 3].map((k) => match(`o${j}${k}`, j, `e${k}`, j)),
    );
    expect(detecterGroupesFermes([...entreEux, ...ouverts, ...exterieurs])).toEqual([]);
  });

  it("ignore un site où il n'y a personne d'autre, et les matchs non vérifiés", () => {
    expect(detecterGroupesFermes(entreEux)).toEqual([]);
    const nonVerifies = entreEux.map((m) => ({ ...m, verifie: false }));
    expect(detecterGroupesFermes([...nonVerifies, ...exterieurs])).toEqual([]);
  });

  it("figure dans les signaux à examiner", () => {
    expect(detecterSignaux([...entreEux, ...exterieurs], [], []).groupesFermes).toHaveLength(1);
  });
});
