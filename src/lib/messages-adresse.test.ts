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

  it("navigateur sans Sec-Fetch-Site : garde le message si la visite vient d'une page du site", () => {
    const adresse = new URL(`${cv}?coach=Suivi%20termin%C3%A9#coach`);
    expect(sansMessagesForges(adresse, null, "https://najarena.example/joueur/vipere")).toBeNull();
    // Venue d'ailleurs, sans page d'origine, ou d'un site qui commence pareil.
    for (const referer of ["https://piege.example/", null, "", "pas une adresse", "https://najarena.example.piege.example/"]) {
      expect(sansMessagesForges(adresse, null, referer)?.searchParams.has("coach"), String(referer)).toBe(false);
    }
    // Si Sec-Fetch-Site est présent, lui seul compte (un Referer du site ne
    // rattrape pas une navigation venue d'ailleurs).
    expect(sansMessagesForges(adresse, "cross-site", "https://najarena.example/")?.searchParams.has("coach")).toBe(false);
    expect(sansMessagesForges(adresse, "none", "https://najarena.example/")?.searchParams.has("coach")).toBe(false);
  });

  it("garde les retours prévus depuis Stripe ou un lien de connexion", () => {
    const retour = new URL(`https://najarena.example/moi?message=${encodeURIComponent(RETOURS_EXTERNES.abonnementEnCours)}`);
    expect(sansMessagesForges(retour, "cross-site")).toBeNull();
  });

  it("un doublon (texte admis + texte piégé) est retiré en entier", () => {
    const piege = new URL(
      `${cv}?coach=${encodeURIComponent(RETOURS_EXTERNES.abonnementEnCours)}&coach=Pi%C3%A8ge`,
    );
    expect(sansMessagesForges(piege, "cross-site")?.searchParams.has("coach")).toBe(false);
    const doubleAdmis = new URL(
      `https://najarena.example/moi?message=${encodeURIComponent(RETOURS_EXTERNES.abonnementEnCours)}&message=${encodeURIComponent(RETOURS_EXTERNES.abonnementEnCours)}`,
    );
    expect(sansMessagesForges(doubleAdmis, "cross-site")?.searchParams.has("message")).toBe(false);
  });

  it("un retour admis ne l'est qu'à sa page et sous son nom", () => {
    const ailleurs = new URL(`${cv}?reco=${encodeURIComponent(RETOURS_EXTERNES.identiteVerifiee)}`);
    expect(sansMessagesForges(ailleurs, "cross-site")?.searchParams.has("reco")).toBe(false);
  });

  it("rien à faire sans message", () => {
    expect(sansMessagesForges(new URL(`${cv}?onglet=lol`), "cross-site")).toBeNull();
  });
});
