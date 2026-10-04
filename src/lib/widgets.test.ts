import { describe, expect, it } from "vitest";
import { optionsWidget, widgetBracket, widgetJoueur, widgetTop } from "./widgets";

const opaque = { transparent: false };

describe("widgets", () => {
  it("échappe les noms venant des utilisateurs", () => {
    const html = widgetBracket(
      {
        slug: "t",
        nom: "<script>alert(1)</script>",
        statut: "en_cours",
        format: "1v1",
        capacite: 2,
        region: "EUW",
        debuteLe: "2026-10-03T20:00:00Z",
        url: "https://najarena.example/lol/tournois/t",
        matchs: [
          {
            tour: 1,
            position: 1,
            participants: [
              { nom: "A&B", slug: "ab", score: 1, gagnant: true },
              { nom: "C", slug: "c", score: 0, gagnant: false },
            ],
            verdict: { niveau: "historique", verifie: true },
          },
        ],
      },
      opaque,
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("✓ vérifié");
  });

  it("un verdict manuel n'est jamais présenté comme vérifié", () => {
    const html = widgetBracket(
      {
        slug: "t",
        nom: "T",
        statut: "termine",
        format: "1v1",
        capacite: 2,
        region: "EUW",
        debuteLe: "2026-10-03T20:00:00Z",
        url: "https://x",
        matchs: [{ tour: 1, position: 1, participants: [], verdict: { niveau: "manuel", verifie: false } }],
      },
      opaque,
    );
    expect(html).toContain(">manuel<");
    expect(html).not.toContain("✓ vérifié");
  });

  it("pas de rating affiché avant l'entrée au classement", () => {
    const base = {
      pseudo: "Ana",
      slug: "ana",
      pays: null,
      palier: null,
      matchsJoues: 3,
      matchsVerifies: 3,
      url: "https://x/joueur/ana",
    };
    const nonClasse = widgetJoueur({ ...base, classe: false, rating: null, confiancePct: 40 }, opaque);
    expect(nonClasse).toContain("Pas encore classé");
    expect(nonClasse).toContain("40 %");
    const classe = widgetJoueur({ ...base, classe: true, rating: 1720, palier: "Or", confiancePct: 100 }, opaque);
    expect(classe).toContain("1720");
  });

  it("top vide et fond transparent", () => {
    expect(widgetTop([], "https://x", opaque)).toContain("Personne n'est encore classé");
    const options = optionsWidget(new URLSearchParams("fond=transparent"));
    expect(widgetTop([], "https://x", options)).toContain("background:transparent");
  });
});
