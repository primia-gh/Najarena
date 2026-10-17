import { describe, expect, it } from "vitest";
import { redirectionCanonique } from "./reponses-publiques";

describe("redirectionCanonique", () => {
  const base = "https://najarena.example/api/public/v1/joueurs";

  it("laisse passer l'adresse canonique", () => {
    expect(redirectionCanonique(new Request(`${base}/vipere/recalcul`))).toBeNull();
  });

  it("renvoie vers l'adresse sans paramètres et en minuscules, lisible par tous les sites", () => {
    for (const adresse of [`${base}/vipere/recalcul?x=1`, `${base}/Vipere/recalcul`, `${base}/VIPERE/recalcul?`]) {
      const reponse = redirectionCanonique(new Request(adresse));
      expect(reponse?.status, adresse).toBe(308);
      expect(reponse?.headers.get("Location")).toBe("/api/public/v1/joueurs/vipere/recalcul");
      expect(reponse?.headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
  });
});
