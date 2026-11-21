import { describe, expect, it } from "vitest";
import { redirectionCanonique, redirectionWidget } from "./reponses-publiques";

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

describe("adresse codée", () => {
  it("API : la lettre déguisée en code est décodée, un code invalide est refusé", () => {
    const reponse = redirectionCanonique(
      new Request("https://najarena.example/api/public/v1/joueurs/v%69pere/recalcul"),
    );
    expect(reponse?.status).toBe(308);
    expect(reponse?.headers.get("Location")).toBe("/api/public/v1/joueurs/vipere/recalcul");
    expect(
      redirectionCanonique(new Request("https://najarena.example/api/public/v1/joueurs/%E0%A4%A/recalcul"))?.status,
    ).toBe(400);
    expect(redirectionWidget(new Request("https://najarena.example/widget/joueur/%E0%A4%A/match"))?.status).toBe(400);
  });
});

describe("redirectionWidget", () => {
  const base = "https://najarena.example/widget/joueur/vipere/match";

  it("laisse passer l'adresse canonique, avec ou sans fond transparent", () => {
    expect(redirectionWidget(new Request(base))).toBeNull();
    expect(redirectionWidget(new Request(`${base}?fond=transparent`))).toBeNull();
  });

  it("ne garde que le fond transparent et met le chemin en minuscules", () => {
    const cas: [string, string][] = [
      [`${base}?x=1`, "/widget/joueur/vipere/match"],
      [`${base}?fond=noir`, "/widget/joueur/vipere/match"],
      [`${base}?fond=transparent&x=1`, "/widget/joueur/vipere/match?fond=transparent"],
      [`${base}?x=1&fond=transparent`, "/widget/joueur/vipere/match?fond=transparent"],
      [
        "https://najarena.example/widget/joueur/Vipere/match?fond=transparent",
        "/widget/joueur/vipere/match?fond=transparent",
      ],
      // Une lettre déguisée en code ne fait pas une adresse de plus pour le cache.
      ["https://najarena.example/widget/joueur/%76ipere/match", "/widget/joueur/vipere/match"],
      ["https://najarena.example/widget/match/%61bc", "/widget/match/abc"],
    ];
    for (const [adresse, cible] of cas) {
      const reponse = redirectionWidget(new Request(adresse));
      expect(reponse?.status, adresse).toBe(308);
      expect(reponse?.headers.get("Location"), adresse).toBe(cible);
    }
  });
});
