import { describe, expect, it } from "vitest";
import { libelleLienExterne, lienExterneSur } from "@/lib/lien-externe";

describe("lienExterneSur", () => {
  it("garde une adresse web complète", () => {
    expect(lienExterneSur("https://twitter.com/mon_pseudo")).toBe("https://twitter.com/mon_pseudo");
    expect(lienExterneSur("  http://www.twitch.tv/x?ref=cv#live ")).toBe("http://www.twitch.tv/x?ref=cv#live");
    expect(lienExterneSur("https://sponsor.example:8443")).toBe("https://sponsor.example:8443/");
  });

  it("convertit accents et espaces comme le navigateur", () => {
    expect(lienExterneSur("https://fr.wikipedia.org/wiki/Étoile")).toBe("https://fr.wikipedia.org/wiki/%C3%89toile");
    expect(lienExterneSur("https://www.youtube.com/@Pépé")).toBe("https://www.youtube.com/@P%C3%A9p%C3%A9");
    expect(lienExterneSur("https://café.fr")).toBe("https://xn--caf-dma.fr/");
    expect(lienExterneSur("HTTPS://Site.Example/a b")).toBe("https://site.example/a%20b");
  });

  it("refuse ce qui n'est pas l'adresse d'un site", () => {
    for (const lien of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<p>x</p>",
      "/moi?message=Bravo",
      "//piege.example",
      "twitter.com/x",
      "https://localhost/x",
      "https://192.168.1.1/admin",
      "https://0x7f.1/",
      "https://-.-/",
      "ftp://site.example",
      "https://najarena.fr@piege.example/",
      "https://site.example:443@piege.example/",
      `https://site.example/${"a".repeat(300)}`,
    ]) {
      expect(lienExterneSur(lien), lien).toBeNull();
    }
    expect(lienExterneSur("")).toBeNull();
    expect(lienExterneSur(null)).toBeNull();
  });

  it("ne change pas de site (barre oblique inverse)", () => {
    expect(lienExterneSur("https://good.example\\evil.example")).toBe("https://good.example/evil.example");
  });

  it("retire les messages d'adresse", () => {
    expect(lienExterneSur("https://najarena.fr/moi?message=Gain%20vers%C3%A9")).toBe("https://najarena.fr/moi");
    expect(lienExterneSur("https://najarena.fr/joueur/x?coach=a&tab=lol#coach")).toBe(
      "https://najarena.fr/joueur/x?tab=lol#coach",
    );
  });
});

describe("libelleLienExterne", () => {
  it("affiche le nom du site seul", () => {
    expect(libelleLienExterne("https://www.youtube.com/@x?si=abc#t")).toBe("youtube.com");
    expect(libelleLienExterne("https://twitter.com/dave/status/1")).toBe("twitter.com");
    expect(libelleLienExterne("https://xn--caf-dma.fr/")).toBe("xn--caf-dma.fr");
  });
});
