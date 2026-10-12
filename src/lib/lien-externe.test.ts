import { describe, expect, it } from "vitest";
import { lienExterneSur } from "@/lib/lien-externe";

describe("lienExterneSur", () => {
  it("garde une adresse web complète", () => {
    expect(lienExterneSur("https://twitter.com/mon_pseudo")).toBe("https://twitter.com/mon_pseudo");
    expect(lienExterneSur("  http://www.twitch.tv/x?ref=cv#live ")).toBe("http://www.twitch.tv/x?ref=cv#live");
    expect(lienExterneSur("https://sponsor.example:8443")).toBe("https://sponsor.example:8443");
  });

  it("refuse ce qui n'est pas une adresse web", () => {
    for (const lien of [
      "javascript:alert(1)",
      "data:text/html,<p>x</p>",
      "/moi?message=Bravo",
      "//piege.example",
      "twitter.com/x",
      "https://localhost/x",
      "ftp://site.example",
      "https://najarena.fr@piege.example/",
      "https://site.example/a b",
      "https://site.example/‮",
      `https://site.example/${"a".repeat(300)}`,
    ]) {
      expect(lienExterneSur(lien), lien).toBeNull();
    }
    expect(lienExterneSur("")).toBeNull();
    expect(lienExterneSur(null)).toBeNull();
  });

  it("retire les messages d'adresse", () => {
    expect(lienExterneSur("https://najarena.fr/moi?message=Gain%20vers%C3%A9")).toBe("https://najarena.fr/moi");
    expect(lienExterneSur("https://najarena.fr/joueur/x?coach=a&tab=lol#coach")).toBe(
      "https://najarena.fr/joueur/x?tab=lol#coach",
    );
  });
});
