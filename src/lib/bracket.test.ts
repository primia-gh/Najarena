import { describe, expect, it } from "vitest";
import { ordreDesSeeds, calculerByesEnCascade } from "./bracket";

describe("ordreDesSeeds", () => {
  it("capacité 1 : un seul seed", () => {
    expect(ordreDesSeeds(1)).toEqual([1]);
  });

  it("capacité 4 : seed1 vs seed4, seed2 vs seed3 (exemple de référence du commentaire)", () => {
    expect(ordreDesSeeds(4)).toEqual([1, 4, 2, 3]);
  });

  it.each([4, 8, 16, 32, 64])(
    "capacité %i : contient chaque seed de 1 à la capacité exactement une fois",
    (capacite) => {
      const ordre = ordreDesSeeds(capacite);
      expect(ordre).toHaveLength(capacite);
      expect(new Set(ordre).size).toBe(capacite);
      expect([...ordre].sort((a, b) => a - b)).toEqual(
        Array.from({ length: capacite }, (_, i) => i + 1),
      );
    },
  );

  it.each([4, 8, 16, 32, 64])(
    "capacité %i : chaque paire de premier tour se somme à capacité+1 (chaque match oppose le meilleur et le pire seed restants)",
    (capacite) => {
      const ordre = ordreDesSeeds(capacite);
      for (let i = 0; i < capacite; i += 2) {
        expect(ordre[i] + ordre[i + 1]).toBe(capacite + 1);
      }
    },
  );

  it("capacité 8 avec 5 joueurs confirmés : aucun match du tour 1 ne se retrouve à 0 participant (bug #1 corrigé le 2026-09-11)", () => {
    // Repro exacte de la régression : moins de joueurs confirmés que de
    // places, un ordre naïf (seed = position) pouvait placer deux seeds
    // absents côte à côte dans le même match.
    const capacite = 8;
    const nbJoueurs = 5;
    const ordre = ordreDesSeeds(capacite);

    for (let position = 0; position < capacite / 2; position++) {
      const seedA = ordre[position * 2];
      const seedB = ordre[position * 2 + 1];
      const participants = [seedA, seedB].filter((s) => s <= nbJoueurs).length;
      expect(participants).toBeGreaterThan(0);
    }
  });
});

describe("calculerByesEnCascade", () => {
  it("capacité 4, 4 joueurs : aucun bye, tout se joue en vrais matchs", () => {
    expect(calculerByesEnCascade(4, 4)).toEqual([]);
  });

  it("capacité 4, 3 joueurs : un seul bye au tour 1, le tour 2 (finale) reste un vrai match en attente", () => {
    // ordre = [1,4,2,3] : seed4 absent → seed1 a un bye. seed2 vs seed3
    // est un vrai match, jamais résolu par cette fonction.
    expect(calculerByesEnCascade(4, 3)).toEqual([{ tour: 1, position: 1, gagnantSeed: 1 }]);
  });

  it("capacité 2, 2 joueurs : un seul tour, jamais de bye à calculer", () => {
    expect(calculerByesEnCascade(2, 2)).toEqual([]);
  });

  it("capacité 8, 2 joueurs : cascade sur deux tours jusqu'à la finale (bug #3 du 2026-09-12 — match vide bloquant à tort)", () => {
    // Avant le correctif, le tour 2 restait bloqué indéfiniment : les deux
    // matchs vides du tour 1 (0 participant) étaient traités comme "non
    // décidés" et empêchaient les byes du tour 2 de se résoudre, alors
    // qu'un match vide ne peut structurellement plus jamais produire de
    // participant. Les deux joueurs doivent atteindre la finale (tour 3)
    // sans intervention manuelle.
    const byes = calculerByesEnCascade(8, 2);

    expect(byes).toContainEqual({ tour: 1, position: 1, gagnantSeed: 1 });
    expect(byes).toContainEqual({ tour: 1, position: 3, gagnantSeed: 2 });
    expect(byes).toContainEqual({ tour: 2, position: 1, gagnantSeed: 1 });
    expect(byes).toContainEqual({ tour: 2, position: 2, gagnantSeed: 2 });
    expect(byes).toHaveLength(4);
  });

  it("capacité 8, 5 joueurs : seed1 attend au tour 2 le vainqueur de seed4 vs seed5, sans bye de plus (bug #2 du 2026-09-11, réapparu le 12/09, corrigé le 24/09)", () => {
    // Tour 1 : seed1, seed2 et seed3 ont un bye ; seed4 vs seed5 est un
    // vrai match. Au tour 2, seed1 attend le vainqueur de ce vrai match :
    // il ne doit JAMAIS passer directement en finale. Jusqu'au 24/09, ce
    // test affirmait l'inverse (bye de seed1 au tour 2), et le vainqueur
    // de seed4 vs seed5 arrivait dans un match déjà terminé.
    expect(calculerByesEnCascade(8, 5)).toEqual([
      { tour: 1, position: 1, gagnantSeed: 1 },
      { tour: 1, position: 3, gagnantSeed: 2 },
      { tour: 1, position: 4, gagnantSeed: 3 },
    ]);
  });

  it("capacité 16, 5 joueurs : les byes en cascade s'arrêtent devant le vrai match seed4 vs seed5", () => {
    const byes = calculerByesEnCascade(16, 5);
    expect(byes).toContainEqual({ tour: 2, position: 1, gagnantSeed: 1 });
    expect(byes.some((b) => b.tour === 3 && b.position === 1)).toBe(false);
  });

  it("ne produit jamais deux fois la même position (chaque match n'est résolu qu'une fois)", () => {
    for (const [capacite, nbJoueurs] of [[8, 2], [8, 5], [16, 3], [32, 7]] as const) {
      const byes = calculerByesEnCascade(capacite, nbJoueurs);
      const cles = byes.map((b) => `${b.tour}-${b.position}`);
      expect(new Set(cles).size).toBe(cles.length);
    }
  });

  // Joue le bracket jusqu'au bout comme la base le ferait (byes, puis
  // avancer_vainqueur après chaque vrai match — le plus petit seed gagne)
  // et échoue au moindre joueur qui saute un tour ou arrive dans un
  // match déjà décidé.
  function jouerBracketComplet(capacite: number, nbJoueurs: number) {
    const nbTours = Math.log2(capacite);
    const ordre = ordreDesSeeds(capacite);
    const matchs = new Map<string, { participants: number[]; gagnant?: number }>();
    for (let tour = 1; tour <= nbTours; tour++) {
      for (let position = 1; position <= capacite / 2 ** tour; position++) {
        matchs.set(`${tour}-${position}`, { participants: [] });
      }
    }
    for (let i = 0; i < capacite; i++) {
      if (ordre[i] <= nbJoueurs) matchs.get(`1-${Math.floor(i / 2) + 1}`)!.participants.push(ordre[i]);
    }

    const avancer = (cle: string, gagnant: number) => {
      const match = matchs.get(cle)!;
      if (match.gagnant !== undefined) throw new Error(`${cle} déjà décidé`);
      match.gagnant = gagnant;
      const [tour, position] = cle.split("-").map(Number);
      if (tour === nbTours) return;
      const suivant = matchs.get(`${tour + 1}-${Math.ceil(position / 2)}`)!;
      if (suivant.gagnant !== undefined) throw new Error(`seed ${gagnant} arrive dans un match déjà décidé`);
      suivant.participants.push(gagnant);
    };

    for (const bye of calculerByesEnCascade(capacite, nbJoueurs)) {
      const match = matchs.get(`${bye.tour}-${bye.position}`)!;
      expect(match.participants).toEqual([bye.gagnantSeed]);
      avancer(`${bye.tour}-${bye.position}`, bye.gagnantSeed);
    }

    let vraisMatchs = 0;
    for (;;) {
      const aJouer = Array.from(matchs.entries()).find(([, m]) => m.participants.length === 2 && m.gagnant === undefined);
      if (!aJouer) break;
      vraisMatchs += 1;
      avancer(aJouer[0], Math.min(...aJouer[1].participants));
    }

    const bloques = Array.from(matchs.values()).filter((m) => m.participants.length === 1 && m.gagnant === undefined);
    return { vraisMatchs, champion: matchs.get(`${nbTours}-1`)!.gagnant, bloques: bloques.length };
  }

  it("tous les brackets de 4 à 64 places, de 2 joueurs à complet : chacun joue ses vrais matchs, un seul vainqueur, rien de bloqué", () => {
    for (const capacite of [4, 8, 16, 32, 64]) {
      for (let nbJoueurs = 2; nbJoueurs <= capacite; nbJoueurs++) {
        const { vraisMatchs, champion, bloques } = jouerBracketComplet(capacite, nbJoueurs);
        expect({ capacite, nbJoueurs, vraisMatchs, champion, bloques }).toEqual({
          capacite,
          nbJoueurs,
          vraisMatchs: nbJoueurs - 1,
          champion: 1,
          bloques: 0,
        });
      }
    }
  });
});
