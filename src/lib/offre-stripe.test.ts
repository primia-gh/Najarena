import { describe, expect, it } from "vitest";
import { abonnementEnVie, joueurDeLAbonnement, listePrix, offreDepuisPrix, prixCourant } from "./offre-stripe";

const PRIX = { verifie: "price_plus", elite: "price_pro, price_pro_ancien", organisateur: "price_orga" };

describe("offreDepuisPrix", () => {
  it("retrouve l'offre du prix facturé, ancien prix compris", () => {
    expect(offreDepuisPrix("price_plus", PRIX)).toBe("verifie");
    expect(offreDepuisPrix("price_orga", PRIX)).toBe("organisateur");
    expect(offreDepuisPrix("price_pro_ancien", PRIX)).toBe("elite");
  });

  it("aucune offre pour un prix inconnu, absent, ou une offre sans prix réglé", () => {
    expect(offreDepuisPrix("price_autre", PRIX)).toBeNull();
    expect(offreDepuisPrix(null, PRIX)).toBeNull();
    expect(offreDepuisPrix("", { verifie: "", elite: undefined, organisateur: undefined })).toBeNull();
    expect(offreDepuisPrix(undefined, { verifie: undefined, elite: undefined, organisateur: undefined })).toBeNull();
  });
});

describe("listePrix et prixCourant", () => {
  it("lit une liste séparée par des virgules, le premier prix pour les nouvelles souscriptions", () => {
    expect(listePrix(" price_a , price_b,, ")).toEqual(["price_a", "price_b"]);
    expect(prixCourant("price_a, price_b")).toBe("price_a");
    expect(prixCourant(undefined)).toBeUndefined();
    expect(prixCourant(" , ")).toBeUndefined();
  });
});

describe("joueurDeLAbonnement", () => {
  it("sert le compte étiqueté par notre serveur", () => {
    expect(joueurDeLAbonnement("profil-a", "profil-a")).toBe("profil-a");
    expect(joueurDeLAbonnement("profil-a", null)).toBe("profil-a");
    expect(joueurDeLAbonnement("profil-a")).toBe("profil-a");
  });

  it("n'accorde rien à un abonnement créé hors du site (sans étiquette)", () => {
    expect(joueurDeLAbonnement(undefined, "profil-a")).toBeNull();
    expect(joueurDeLAbonnement(null, "profil-a")).toBeNull();
    expect(joueurDeLAbonnement("", "profil-a")).toBeNull();
  });

  it("refuse une référence de session qui désigne un autre compte", () => {
    expect(joueurDeLAbonnement("profil-a", "profil-b")).toBeNull();
  });
});

describe("abonnementEnVie", () => {
  it("un abonnement terminé n'empêche pas d'en prendre un nouveau", () => {
    expect(abonnementEnVie("canceled")).toBe(false);
    expect(abonnementEnVie("incomplete_expired")).toBe(false);
  });

  it("un abonnement en cours, impayé ou en attente compte encore", () => {
    for (const statut of ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]) {
      expect(abonnementEnVie(statut)).toBe(true);
    }
  });
});
