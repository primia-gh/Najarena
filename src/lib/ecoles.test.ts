import { describe, expect, it } from "vitest";
import {
  adresseAcceptee,
  classementEcoles,
  libelleDomaines,
  lireDomaines,
  messageRefusEcole,
  publicReserve,
  typeCommunaute,
} from "./ecoles";

describe("domaines de l'établissement", () => {
  it("lit la saisie du fondateur comme la base : minuscules, sans arobase, sans doublon", () => {
    expect(lireDomaines(" @Etu.Univ-X.fr, univ-x.fr\nuniv-x.fr ;  ")).toEqual(["etu.univ-x.fr", "univ-x.fr"]);
    expect(lireDomaines("   ")).toEqual([]);
  });

  it("affiche les adresses acceptées", () => {
    expect(libelleDomaines(["etu.univ-x.fr", "univ-x.fr"])).toBe("@etu.univ-x.fr, @univ-x.fr");
  });

  it("accepte le domaine et ses sous-domaines, rien d'autre", () => {
    expect(adresseAcceptee(" Alix.Dupont@Etu.Univ-X.fr ", ["univ-x.fr"])).toBe(true);
    expect(adresseAcceptee("alix@univ-x.fr", ["univ-x.fr"])).toBe(true);
    expect(adresseAcceptee("alix@fauxuniv-x.fr", ["univ-x.fr"])).toBe(false);
    expect(adresseAcceptee("alix@univ-x.fr.exemple.com", ["univ-x.fr"])).toBe(false);
    expect(adresseAcceptee("alix@gmail.com", ["univ-x.fr"])).toBe(false);
    expect(adresseAcceptee("pas-une-adresse", ["univ-x.fr"])).toBe(false);
  });
});

describe("classementEcoles", () => {
  it("numérote les écoles classées, garde à part celles en constitution", () => {
    const { classees, enConstitution } = classementEcoles([
      { slug: "a", nom: "A", couleur: "#2BD47D", verifies: 9, classes: 6, moyenne_top5: "1612.40" },
      { slug: "b", nom: "B", couleur: "#2BD47D", verifies: 7, classes: 5, moyenne_top5: 1580 },
      { slug: "c", nom: "C", couleur: "#2BD47D", verifies: 3, classes: 2, moyenne_top5: null },
    ]);
    expect(classees.map((e) => [e.rang, e.slug, e.moyenne])).toEqual([
      [1, "a", 1612.4],
      [2, "b", 1580],
    ]);
    expect(enConstitution.map((e) => e.slug)).toEqual(["c"]);
  });
});

describe("messages et libellés", () => {
  it("traduit les refus de la base", () => {
    expect(messageRefusEcole('ERROR: P0001: DOMAINE_GRAND_PUBLIC', "x")).toMatch(/grand public/);
    expect(messageRefusEcole("TROP_DE_CODES", "x")).toMatch(/3 par heure/);
    expect(messageRefusEcole("inconnu", "Par défaut")).toBe("Par défaut");
  });

  it("dit à qui un tournoi réservé est ouvert", () => {
    expect(publicReserve({ nom: "Esport Univ", type: "ecole" })).toBe(
      "membres vérifiés de Esport Univ (adresse de l'établissement)",
    );
    expect(publicReserve({ nom: "Club", type: "communaute" })).toBe("membres de Club");
    expect(typeCommunaute(null)).toBe("communaute");
  });
});
