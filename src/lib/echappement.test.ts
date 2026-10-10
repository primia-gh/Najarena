import { describe, expect, it } from "vitest";
import { decoderEntites, echapperDiscord, echapperHtml, lienSur } from "./echappement";

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

describe("échappement Discord", () => {
  it("empêche un lien masqué et la mise en forme", () => {
    expect(echapperDiscord("[Réclame ton gain](https://piege.example)")).toBe(
      "\\[Réclame ton gain\\](https://piege.example)",
    );
    expect(echapperDiscord("**Cup** _du_ soir")).toBe("\\*\\*Cup\\*\\* \\_du\\_ soir");
  });

  it("neutralise un titre ou une citation en début de ligne, pas au milieu", () => {
    expect(echapperDiscord("# Annonce")).toBe("\\# Annonce");
    expect(echapperDiscord("> cite")).toBe("\\> cite");
    expect(echapperDiscord("Cup #3 - finale")).toBe("Cup #3 - finale");
  });
});

describe("lienSur", () => {
  const base = "https://najarena.example";
  it("garde un lien du site", () => {
    expect(lienSur(`${base}/joueur/vipere#coach`, base)).toBe(`${base}/joueur/vipere#coach`);
    expect(lienSur(`${base}/lol/divisions?region=EUW#ma-poule`, base)).toBe(`${base}/lol/divisions?region=EUW#ma-poule`);
  });

  it("refuse un lien d'un autre site ou piégé, et renvoie l'accueil", () => {
    expect(lienSur("https://piege.example/joueur/x", base)).toBe(base);
    expect(lienSur(`${base}.piege.example/x`, base)).toBe(base);
    expect(lienSur(`${base}/joueur/x\n\n**Sécurité** [Confirme](https://piege.example)`, base)).toBe(base);
    expect(lienSur(`${base}/joueur/x)`, base)).toBe(base);
  });
});
