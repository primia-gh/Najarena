import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseMatch } from "./Bracket";

// Chances estimées et exploits (audit N10) : affichés dans la case du match.
describe("case de match", () => {
  it("affiche les chances estimées d'un match pas encore joué", () => {
    const html = renderToStaticMarkup(
      <CaseMatch
        etat="a_venir"
        monMatch={false}
        participants={[
          { cle: "a", pseudo: "Ahri", slug: null, score: null, estGagnant: null, chances: 62 },
          { cle: "b", pseudo: "Zed", slug: null, score: null, estGagnant: null, chances: 38 },
        ]}
      />,
    );
    expect(html).toContain("62 %");
    expect(html).toContain("38 %");
    expect(html).toContain("de chances estimées");
  });

  it("montre le score et le badge Exploit d'une victoire vérifiée inattendue", () => {
    const html = renderToStaticMarkup(
      <CaseMatch
        etat="verdict"
        niveau="historique"
        monMatch={false}
        exploit={28}
        participants={[
          { cle: "a", pseudo: "Ahri", slug: null, score: 0, estGagnant: false, chances: 72 },
          { cle: "b", pseudo: "Zed", slug: null, score: 1, estGagnant: true, chances: 28 },
        ]}
      />,
    );
    expect(html).toContain("Exploit");
    expect(html).toContain("28 % de chances estimées avant le match");
    expect(html).not.toContain("72 %");
  });
});
