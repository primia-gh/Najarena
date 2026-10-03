import { describe, expect, it } from "vitest";
import { construireDemandeRevue, validerRevue } from "./revue-ia";

const moi = {
  champion: "Ahri",
  kills: 5,
  deaths: 2,
  assists: 3,
  cs: 180,
  orGagne: 9000,
  dureeSecondes: 900,
  gagne: true,
};

describe("revue de match IA", () => {
  it("ne transmet que les chiffres officiels, mis en forme", () => {
    const { systeme, contenu } = construireDemandeRevue({
      format: "1v1",
      moi,
      adversaire: { ...moi, champion: "Zed", gagne: false, cs: 150 },
      moyennesVictoires: null,
      moyennesDefaites: null,
    });
    expect(systeme).toMatch(/n'invente rien/);
    expect(contenu).toContain("Le joueur : Ahri, victoire, 5/2/3 (K/D/A), 180 sbires (12.0 par minute)");
    expect(contenu).toContain("Son adversaire : Zed, défaite");
    expect(contenu).toContain("durée de la partie 15 min 00 s");
    expect(contenu).toContain("pas encore assez de parties vérifiées");
  });

  it("refuse une réponse mal formée ou démesurée", () => {
    expect(validerRevue({ points: ["Bon CS : 12 par minute."], conseil: "Garde ce rythme." })).toEqual({
      points: ["Bon CS : 12 par minute."],
      conseil: "Garde ce rythme.",
    });
    expect(validerRevue({ points: [], conseil: "x" })).toBeNull();
    expect(validerRevue({ points: ["a", "b", "c", "d", "e"], conseil: "x" })).toBeNull();
    expect(validerRevue({ points: ["a"], conseil: "x".repeat(500) })).toBeNull();
    expect(validerRevue("texte libre")).toBeNull();
  });
});
