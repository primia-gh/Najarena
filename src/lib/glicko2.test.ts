// Vérifié en diffant contre l'implémentation de référence docs/glicko2.py
// (voir [[glicko2-reference-python-only]] — jamais un portage, une
// vérification). Valeurs de référence recalculées via `py -3` sur
// docs/glicko2.py, pas devinées.
import { describe, expect, it } from "vitest";
import { mettreAJourJoueur, softResetSaison, RD_MAX, type EtatGlicko } from "./glicko2";

const PRECISION = 6;

describe("mettreAJourJoueur", () => {
  it("un nouveau joueur qui bat un joueur établi gagne du rating et perd de l'incertitude", () => {
    const nouveau: EtatGlicko = { rating: 1500, rd: 350, volatilite: 0.06 };
    const etabli: EtatGlicko = { rating: 1400, rd: 30, volatilite: 0.06 };

    const resultat = mettreAJourJoueur(nouveau, [{ adversaire: etabli, score: 1 }]);

    expect(resultat.rating).toBeCloseTo(1631.368919949588, PRECISION);
    expect(resultat.rd).toBeCloseTo(252.16000623738702, PRECISION);
    expect(resultat.volatilite).toBeCloseTo(0.0599988681523054, PRECISION);
  });

  it("un nouveau joueur qui perd contre un joueur établi perd du rating", () => {
    const nouveau: EtatGlicko = { rating: 1500, rd: 350, volatilite: 0.06 };
    const etabli: EtatGlicko = { rating: 1400, rd: 30, volatilite: 0.06 };

    const resultat = mettreAJourJoueur(nouveau, [{ adversaire: etabli, score: 0 }]);

    expect(resultat.rating).toBeCloseTo(1266.993987735771, PRECISION);
    expect(resultat.rd).toBeCloseTo(252.1600081755214, PRECISION);
    expect(resultat.volatilite).toBeCloseTo(0.05999987175556412, PRECISION);
  });

  it("deux joueurs égaux : le vainqueur et le perdant évoluent symétriquement autour de 1500", () => {
    const joueur: EtatGlicko = { rating: 1500, rd: 200, volatilite: 0.06 };
    const adversaireMiroir: EtatGlicko = { rating: 1500, rd: 200, volatilite: 0.06 };

    const gagnant = mettreAJourJoueur(joueur, [{ adversaire: adversaireMiroir, score: 1 }]);
    const perdant = mettreAJourJoueur(joueur, [{ adversaire: adversaireMiroir, score: 0 }]);

    expect(gagnant.rating).toBeCloseTo(1578.801716729907, PRECISION);
    expect(gagnant.rd).toBeCloseTo(180.07829080441664, PRECISION);
    expect(perdant.rating).toBeCloseTo(1421.198283270093, PRECISION);
    expect(perdant.rd).toBeCloseTo(180.07829080441664, PRECISION);
    // Symétrie exacte autour de 1500 pour deux profils miroir.
    expect(gagnant.rating - 1500).toBeCloseTo(1500 - perdant.rating, PRECISION);
  });

  it("aucun match dans la période : le rating ne bouge pas, le RD remonte (inactivité, CLAUDE.md §4)", () => {
    const etat: EtatGlicko = { rating: 1700, rd: 100, volatilite: 0.06 };

    const resultat = mettreAJourJoueur(etat, []);

    expect(resultat.rating).toBe(1700);
    expect(resultat.rd).toBeGreaterThan(100);
    expect(resultat.volatilite).toBe(0.06);
  });

  it("le RD ne dépasse jamais RD_MAX même après une longue inactivité", () => {
    const etat: EtatGlicko = { rating: 1500, rd: RD_MAX, volatilite: 0.2 };

    const resultat = mettreAJourJoueur(etat, []);

    expect(resultat.rd).toBeLessThanOrEqual(RD_MAX);
  });
});

describe("softResetSaison", () => {
  it("rapproche le rating de 1500 de 15% et multiplie le RD par 1.8 (CLAUDE.md §4)", () => {
    const etat: EtatGlicko = { rating: 1700, rd: 100, volatilite: 0.06 };

    const resultat = softResetSaison(etat);

    expect(resultat.rating).toBeCloseTo(1670, PRECISION); // 1700 - 0.15*(1700-1500)
    expect(resultat.rd).toBeCloseTo(180, PRECISION); // 100 * 1.8
    expect(resultat.volatilite).toBe(0.06);
  });

  it("ne remet jamais le rating exactement à 1500, même après plusieurs saisons (jamais de remise à zéro)", () => {
    let etat: EtatGlicko = { rating: 2200, rd: 60, volatilite: 0.06 };
    for (let i = 0; i < 5; i++) etat = softResetSaison(etat);

    expect(etat.rating).toBeGreaterThan(1500);
  });

  it("plafonne le RD à RD_MAX", () => {
    const etat: EtatGlicko = { rating: 1500, rd: 300, volatilite: 0.06 };

    const resultat = softResetSaison(etat);

    expect(resultat.rd).toBe(RD_MAX);
  });
});
