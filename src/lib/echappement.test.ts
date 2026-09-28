import { describe, expect, it } from "vitest";
import { decoderEntites, echapperHtml } from "./echappement";

describe("échappement HTML", () => {
  it("neutralise une balise glissée dans un nom de tournoi", () => {
    expect(echapperHtml(`Cup <a href="https://piege.example">Réclame ton gain</a>`)).toBe(
      "Cup &lt;a href=&quot;https://piege.example&quot;&gt;Réclame ton gain&lt;/a&gt;",
    );
  });

  it("garde le texte lisible une fois décodé", () => {
    const texte = `L'arène & "les" <meilleurs>`;
    expect(decoderEntites(echapperHtml(texte))).toBe(texte);
  });

  it("n'échappe pas deux fois ce qui est décodé une seule fois", () => {
    expect(decoderEntites("&amp;lt;")).toBe("&lt;");
  });
});
