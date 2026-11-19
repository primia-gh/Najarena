import { describe, expect, it } from "vitest";
import { offreDepuisPrix } from "./offre-stripe";

const PRIX = { verifie: "price_plus", elite: "price_pro", organisateur: "price_orga" };

describe("offreDepuisPrix", () => {
  it("retrouve l'offre du prix facturé", () => {
    expect(offreDepuisPrix("price_plus", PRIX)).toBe("verifie");
    expect(offreDepuisPrix("price_orga", PRIX)).toBe("organisateur");
  });

  it("aucune offre pour un prix inconnu, absent, ou une offre sans prix réglé", () => {
    expect(offreDepuisPrix("price_autre", PRIX)).toBeNull();
    expect(offreDepuisPrix(null, PRIX)).toBeNull();
    expect(offreDepuisPrix("", { verifie: "", elite: undefined, organisateur: undefined })).toBeNull();
    expect(offreDepuisPrix(undefined, { verifie: undefined, elite: undefined, organisateur: undefined })).toBeNull();
  });
});
