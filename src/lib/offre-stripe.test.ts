import { describe, expect, it } from "vitest";
import {
  abonnementCourant,
  abonnementEnVie,
  decisionVerification,
  joueurDeLAbonnement,
  listePrix,
  offreDepuisPrix,
  prixConfigures,
  prixCourant,
} from "./offre-stripe";

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

describe("decisionVerification (vérification quotidienne)", () => {
  const prix = { verifie: "price_plus", elite: "price_pro", organisateur: undefined };
  const stripe = (statutStripe: string, prixFacture = "price_plus") => ({ statutStripe, prixFacture, prix });

  it("ne touche jamais une offre donnée à la main", () => {
    expect(decisionVerification({ ...stripe("canceled"), offreActuelle: { offre: "elite", manuelle: true } })).toEqual({ action: "aucune" });
  });
  it("retire l'offre d'un abonnement qui n'est plus en cours", () => {
    for (const statut of ["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(decisionVerification({ ...stripe(statut), offreActuelle: { offre: "verifie", manuelle: false } })).toEqual({ action: "retirer" });
    }
  });
  it("rien à retirer sans offre", () => {
    expect(decisionVerification({ ...stripe("canceled"), offreActuelle: null })).toEqual({ action: "aucune" });
  });
  it("accorde l'offre manquante ou différente d'un abonnement payé ou en essai", () => {
    expect(decisionVerification({ ...stripe("active"), offreActuelle: null })).toEqual({ action: "accorder", offre: "verifie" });
    expect(decisionVerification({ ...stripe("trialing", "price_pro"), offreActuelle: { offre: "verifie", manuelle: false } })).toEqual({
      action: "accorder",
      offre: "elite",
    });
    expect(decisionVerification({ ...stripe("active"), offreActuelle: { offre: "verifie", manuelle: false } })).toEqual({ action: "aucune" });
  });
  it("signale un prix inconnu sans rien retirer", () => {
    expect(decisionVerification({ ...stripe("active", "price_autre"), offreActuelle: { offre: "verifie", manuelle: false } })).toEqual({
      action: "signaler",
      raison: "prix_inconnu",
    });
  });
  it("prixConfigures : au moins un prix réglé", () => {
    expect(prixConfigures({ verifie: undefined, elite: " , ", organisateur: "" })).toBe(false);
    expect(prixConfigures({ verifie: undefined, elite: "price_pro", organisateur: "" })).toBe(true);
  });
});

describe("abonnementCourant", () => {
  const J = "joueur";
  const ab = (id: string, status: string, created: number, profil: string | null = J) => ({
    id,
    status,
    created,
    metadata: (profil ? { profile_id: profil } : {}) as Record<string, string>,
  });

  it("un abonnement en cours l'emporte, le plus récent d'abord", () => {
    const liste = [ab("a", "canceled", 3), ab("b", "active", 1), ab("c", "trialing", 2)];
    expect(abonnementCourant(liste, J, "a")?.id).toBe("c");
  });
  it("sinon celui déjà suivi, sinon le plus récent", () => {
    const liste = [ab("a", "canceled", 1), ab("b", "past_due", 2)];
    expect(abonnementCourant(liste, J, "a")?.id).toBe("a");
    expect(abonnementCourant(liste, J, null)?.id).toBe("b");
  });
  it("ignore les abonnements sans étiquette ou étiquetés pour un autre compte", () => {
    expect(abonnementCourant([ab("a", "active", 1, null), ab("b", "active", 2, "autre")], J, null)).toBeNull();
  });
});
