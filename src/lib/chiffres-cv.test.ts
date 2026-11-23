import { describe, expect, it } from "vitest";
import * as cv from "./chiffres-cv";
import { chiffresCV, type ChiffresCV, type MatchCV } from "./chiffres-cv";

// Espaces insécables ramenés à des espaces pour lire les attentes.
const plat = (f: (c: ChiffresCV) => string) => (c: ChiffresCV) => f(c).replace(/ /g, " ");
const sousMatchsVerifies = plat(cv.sousMatchsVerifies);
const sousVictoires = plat(cv.sousVictoires);
const resumeMatchsVerifies = plat(cv.resumeMatchsVerifies);

const m = (estGagnant: boolean, niveau = "historique", horsClassementNiveau = false): MatchCV => ({
  estGagnant,
  niveau,
  horsClassementNiveau,
});

describe("chiffres en tête du CV", () => {
  it("sans compte sous le niveau 30 : rien ne change", () => {
    const c = chiffresCV([m(true), m(false), m(true, "manuel")]);
    expect(c).toMatchObject({ victoires: 2, defaites: 1, tauxVictoire: 67, matchsVerifies: 2, matchsManuels: 1, matchsSansPoints: 0 });
    expect(sousMatchsVerifies(c)).toBe("+ 1 manuel, hors classement");
    expect(sousVictoires(c)).toBe("2 V · 1 D");
    expect(resumeMatchsVerifies(c)).toBe("2 matchs vérifiés");
  });

  it("un match contre un compte sous le niveau 30 sort du taux et du nombre de matchs vérifiés", () => {
    const c = chiffresCV([m(true), m(false), m(true, "historique", true), m(true, "code_tournoi", true)]);
    expect(c).toMatchObject({ victoires: 1, defaites: 1, tauxVictoire: 50, matchsVerifies: 2, matchsSansPoints: 2 });
    expect(sousMatchsVerifies(c)).toBe("+ 2 sans points");
    expect(sousVictoires(c)).toBe("1 V · 1 D · + 2 sans points");
    expect(resumeMatchsVerifies(c)).toBe("2 matchs vérifiés + 2 sans points");
  });

  it("manuels et sans points sont dits tous les deux", () => {
    const c = chiffresCV([m(true), m(false, "manuel"), m(false, "manuel"), m(true, "historique", true)]);
    expect(sousMatchsVerifies(c)).toBe("+ 2 manuels · + 1 sans points");
  });

  it("que des matchs sans points : pas de taux, pas « aucun match joué »", () => {
    const c = chiffresCV([m(true, "historique", true)]);
    expect(c.tauxVictoire).toBeNull();
    expect(c.matchsVerifies).toBe(0);
    expect(sousVictoires(c)).toBe("1 match sans points");
    expect(resumeMatchsVerifies(c)).toBe("0 match vérifié + 1 sans points");
  });

  it("« + » et « · » ne restent jamais seuls en bout de ligne", () => {
    const c = chiffresCV([m(true), m(false, "manuel"), m(true, "historique", true)]);
    expect(cv.sousMatchsVerifies(c)).toBe("+ 1 manuel · + 1 sans points");
  });

  it("aucun match", () => {
    const c = chiffresCV([]);
    expect(c.tauxVictoire).toBeNull();
    expect(sousVictoires(c)).toBe("Aucun match joué");
    expect(sousMatchsVerifies(c)).toBe("Données officielles");
  });
});
