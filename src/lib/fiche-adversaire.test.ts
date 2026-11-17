import { describe, expect, it } from "vitest";
import { ficheAdversaire, type PartieAdversaire } from "./fiche-adversaire";

const p = (champion: string, gagne: boolean, poste: string | null = "MIDDLE"): PartieAdversaire => ({
  champion,
  gagne,
  poste,
});

describe("ficheAdversaire", () => {
  it("rien sous 3 parties vérifiées", () => {
    expect(ficheAdversaire([p("Ahri", true), p("Zed", false)])).toBeNull();
  });

  it("champions les plus joués d'abord, avec leurs victoires, et le bilan", () => {
    const fiche = ficheAdversaire([
      p("Ahri", true),
      p("Zed", false),
      p("Ahri", true),
      p("Ahri", false),
      p("Yasuo", true),
      p("Zed", true),
    ]);
    expect(fiche).toEqual({
      parties: 6,
      victoires: 4,
      poste: "Milieu",
      champions: [
        { nom: "Ahri", parties: 3, victoires: 2 },
        { nom: "Zed", parties: 2, victoires: 1 },
        { nom: "Yasuo", parties: 1, victoires: 1 },
      ],
    });
  });

  it("au plus 4 champions ; pas de poste s'il n'est pas clairement le plus joué", () => {
    const fiche = ficheAdversaire([
      p("A", true, "TOP"),
      p("B", true, "JUNGLE"),
      p("C", true, "MIDDLE"),
      p("D", true, null),
      p("E", true, null),
    ]);
    expect(fiche?.champions).toHaveLength(4);
    expect(fiche?.poste).toBeNull();
  });
});
