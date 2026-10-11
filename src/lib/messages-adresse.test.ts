import { describe, expect, it } from "vitest";
import { RETOURS_EXTERNES, sansMessagesForges } from "./messages-adresse";

const cv = "https://najarena.example/joueur/vipere";

describe("sansMessagesForges", () => {
  it("garde le message d'une action du site (navigation interne)", () => {
    expect(sansMessagesForges(new URL(`${cv}?coach=Suivi%20termin%C3%A9#coach`), "same-origin")).toBeNull();
  });

  it("retire un texte arrivé par un lien venu d'ailleurs, en gardant le reste de l'adresse", () => {
    const propre = sansMessagesForges(new URL(`${cv}?coach=Va%20sur%20piege.example&onglet=lol#coach`), "cross-site");
    expect(propre?.toString()).toBe(`${cv}?onglet=lol#coach`);
    expect(sansMessagesForges(new URL(`${cv}?erreur=Faux`), "none")?.searchParams.has("erreur")).toBe(false);
    expect(sansMessagesForges(new URL(`${cv}?reco=Faux`), null)?.searchParams.has("reco")).toBe(false);
  });

  it("garde les retours prévus depuis Stripe ou un lien de connexion", () => {
    const retour = new URL(`https://najarena.example/moi?message=${encodeURIComponent(RETOURS_EXTERNES.abonnementEnCours)}`);
    expect(sansMessagesForges(retour, "cross-site")).toBeNull();
  });

  it("rien à faire sans message", () => {
    expect(sansMessagesForges(new URL(`${cv}?onglet=lol`), "cross-site")).toBeNull();
  });
});
