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
            tableau: null,
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
        matchs: [{ tour: 1, position: 1, tableau: null, participants: [], verdict: { niveau: "manuel", verifie: false } }],
      },
      opaque,
    );
    expect(html).toContain(">manuel<");
    expect(html).not.toContain("✓ vérifié");
  });

  it("double élimination : trois blocs titrés et des colonnes nommées", () => {
    const joueur = (nom: string, gagnant: boolean | null) => ({ nom, slug: nom.toLowerCase(), score: gagnant ? 1 : 0, gagnant });
    const html = widgetBracket(
      {
        slug: "d",
        nom: "Coupe double",
        statut: "en_cours",
        format: "1v1",
        capacite: 4,
        region: "EUW",
        debuteLe: "2026-11-21T19:00:00Z",
        url: "https://x",
        matchs: [
          { tour: 1, position: 1, tableau: "gagnants", participants: [joueur("Ana", true), joueur("Bob", false)], verdict: { niveau: "historique", verifie: true } },
          { tour: 1, position: 2, tableau: "gagnants", participants: [joueur("Cid", true), joueur("Dan", false)], verdict: { niveau: "historique", verifie: true } },
          { tour: 2, position: 1, tableau: "gagnants", participants: [joueur("Ana", null), joueur("Cid", null)], verdict: null },
          { tour: 3, position: 1, tableau: "perdants", participants: [joueur("Bob", null), joueur("Dan", null)], verdict: null },
          { tour: 4, position: 1, tableau: "perdants", participants: [], verdict: null },
          { tour: 5, position: 1, tableau: "finale", participants: [], verdict: null },
        ],
      },
      opaque,
    );
    expect(html).toContain("Tableau des gagnants");
    expect(html).toContain("Tableau des perdants");
    expect(html).toContain(">Grande finale<");
    expect(html).toContain("Gagnants · tour 1");
    expect(html).toContain("Finale des gagnants");
    expect(html).toContain("Perdants · tour 1");
    expect(html).toContain("Finale des perdants");
    expect(html.indexOf("Tableau des gagnants")).toBeLessThan(html.indexOf("Tableau des perdants"));
    // Pas de faux « 0 / 0 » avant le verdict.
    expect(html).toMatch(/Ana<\/span><span class="chiffre muted">–</);
    // Titres balisés, zones qui défilent atteignables au clavier.
    expect(html).toContain('<h2 class="sous-titre" id="tableau-perdants">');
    expect(html).toContain('tabindex="0" role="region" aria-label="Tableau des gagnants"');
    // Tous les verdicts présents sont lus chez Riot.
    expect(html).toContain("résultats lus chez Riot");
  });

  it("pied de page : jamais « lus chez Riot » s'il y a une décision manuelle", () => {
    const html = widgetBracket(
      {
        slug: "m",
        nom: "M",
        statut: "en_cours",
        format: "1v1",
        capacite: 4,
        region: "EUW",
        debuteLe: "2026-11-21T19:00:00Z",
        url: "https://x",
        matchs: [
          { tour: 1, position: 1, tableau: null, participants: [{ nom: "A", slug: "a", score: 0, gagnant: true }], verdict: { niveau: "manuel", verifie: false } },
          { tour: 1, position: 2, tableau: null, participants: [{ nom: "B", slug: "b", score: 1, gagnant: true }, { nom: "C", slug: "c", score: 0, gagnant: false }], verdict: { niveau: "historique", verifie: true } },
        ],
      },
      { transparent: true },
    );
    expect(html).not.toContain("résultats lus chez Riot");
    expect(html).toContain("décidé à la main");
    // Fond transparent : ombre portée pour rester lisible sur une image claire.
    expect(html).toContain("text-shadow");
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
