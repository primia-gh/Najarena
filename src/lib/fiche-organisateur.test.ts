import { describe, expect, it } from "vitest";
import { lignesFiche, resumeFiche, type DonneesFiche } from "./fiche-organisateur";

const base: DonneesFiche = {
  tournois_publies: 6,
  tournois_termines: 5,
  tournois_annules: 1,
  matchs_decides: 40,
  matchs_verifies: 36,
  litiges: 3,
  litiges_resolus: 2,
  resolution_mediane_heures: 2.4,
};

describe("fiche organisateur", () => {
  it("met les chiffres en phrases", () => {
    expect(lignesFiche(base)).toEqual([
      { libelle: "Tournois", valeur: "6 publiés · 5 menés à terme · 1 annulé" },
      { libelle: "Résultats lus chez Riot", valeur: "90 % des matchs (36 sur 40)" },
      { libelle: "Litiges", valeur: "2 tranchés sur 3 · délai médian 2 h" },
    ]);
    expect(resumeFiche(base)).toBe("5 tournois menés à terme, 90 % des matchs lus chez Riot");
  });

  it("ne donne pas de pourcentage sur trop peu de matchs", () => {
    const debut = { ...base, matchs_decides: 3, matchs_verifies: 3, litiges: 0, litiges_resolus: 0 };
    expect(lignesFiche(debut)[1].valeur).toBe("3 matchs sur 3");
    expect(lignesFiche(debut)[2].valeur).toBe("aucun");
    expect(resumeFiche(debut)).toBe("5 tournois menés à terme");
    expect(resumeFiche({ ...base, tournois_publies: 0 })).toBeNull();
  });
});
