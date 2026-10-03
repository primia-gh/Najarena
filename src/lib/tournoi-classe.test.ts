import { describe, expect, it } from "vitest";
import { evaluerClassement, libelleEnJeu, publieATemps, type DonneesClassement } from "./tournoi-classe";

const base: DonneesClassement = {
  officiel: false,
  amical: false,
  publieLe: "2026-10-01T18:00:00Z",
  debuteLe: "2026-10-02T19:00:00Z",
  joueursAuDepart: 8,
  inscrits: 8,
  organisateurJoue: false,
  decision: null,
};

describe("tournoi classé", () => {
  it("classe un tournoi publié 25 h avant, à 8 joueurs, sans son organisateur", () => {
    expect(evaluerClassement(base).statut).toBe("classe");
  });

  it("24 h de préavis exactement suffisent, 23 h 59 non", () => {
    expect(publieATemps("2026-10-01T19:00:00Z", "2026-10-02T19:00:00Z")).toBe(true);
    expect(publieATemps("2026-10-01T19:01:00Z", "2026-10-02T19:00:00Z")).toBe(false);
    expect(publieATemps(null, "2026-10-02T19:00:00Z")).toBeNull();
  });

  it("ne classe pas un tournoi publié la veille au soir pour le lendemain midi", () => {
    const e = evaluerClassement({ ...base, publieLe: "2026-10-01T22:00:00Z" });
    expect(e.statut).toBe("non_classe");
    expect(e.criteres[0].etat).toBe("ko");
  });

  it("ne classe pas un tournoi à 7 joueurs au départ", () => {
    const e = evaluerClassement({ ...base, joueursAuDepart: 7 });
    expect(e.statut).toBe("non_classe");
    expect(e.criteres[1]).toMatchObject({ etat: "ko", detail: "7 joueurs au départ." });
  });

  it("ne classe pas un tournoi où joue son organisateur", () => {
    expect(evaluerClassement({ ...base, organisateurJoue: true }).statut).toBe("non_classe");
  });

  it("avant le bracket, reste « à confirmer » et dit combien sont inscrits", () => {
    const e = evaluerClassement({ ...base, joueursAuDepart: null, inscrits: 5 });
    expect(e.statut).toBe("a_confirmer");
    expect(e.criteres[1].detail).toBe("5 inscrits pour l'instant.");
    expect(libelleEnJeu(e.statut, false)).toBe("Classement à confirmer");
  });

  it("un critère déjà manqué l'emporte sur l'attente du bracket", () => {
    const e = evaluerClassement({ ...base, joueursAuDepart: null, organisateurJoue: true });
    expect(e.statut).toBe("non_classe");
  });

  it("un tournoi officiel est classé quel que soit son nombre de joueurs", () => {
    const e = evaluerClassement({ ...base, officiel: true, joueursAuDepart: 4, publieLe: base.debuteLe });
    expect(e.statut).toBe("classe");
    expect(e.criteres).toHaveLength(1);
  });

  it("un tournoi amical n'est jamais classé", () => {
    const e = evaluerClassement({ ...base, amical: true });
    expect(e.statut).toBe("non_classe");
    expect(libelleEnJeu(e.statut, true)).toBe("Match amical");
  });

  it("la décision figée à la clôture fait foi, même si les critères disent autre chose", () => {
    expect(evaluerClassement({ ...base, joueursAuDepart: 4, decision: true }).statut).toBe("classe");
    expect(evaluerClassement({ ...base, decision: false }).statut).toBe("non_classe");
  });

  it("un tournoi 5v5 ne compte jamais au classement individuel", () => {
    const e = evaluerClassement({ ...base, equipes: true, amical: true });
    expect(e.statut).toBe("non_classe");
    expect(e.titre).toBe("Tournoi en équipe");
    expect(libelleEnJeu(e.statut, true, true)).toBe("Palmarès d'équipe");
  });

  it("un défi est classé, sauf le deuxième de la même paire en 24 h (amical)", () => {
    const defi = { ...base, defi: true, joueursAuDepart: 2, publieLe: base.debuteLe };
    expect(evaluerClassement(defi).statut).toBe("classe");
    const amical = evaluerClassement({ ...defi, amical: true });
    expect(amical.statut).toBe("non_classe");
    expect(amical.titre).toBe("Défi amical");
  });
});
