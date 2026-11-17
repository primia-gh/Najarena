import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "./proxy";

// Le proxy filtre les messages passés dans l'adresse (src/lib/messages-
// adresse.ts) : toute page doit y passer, seuls les fichiers de public/ et
// les icônes en sont exclus (contrôle du testeur du 11/10/2026 : une
// exclusion trop large laissait « /equipe/x.png?message=… » s'afficher).
const motif = new RegExp(`^${config.matcher[0]}$`);
const passeParLeProxy = (chemin: string) => motif.test(chemin);

describe("proxy, adresses filtrées", () => {
  it("les fichiers de public/ et les icônes ne passent pas par le proxy", () => {
    const publics = readdirSync(join(process.cwd(), "public"), { withFileTypes: true }).map((f) =>
      f.isDirectory() ? `/${f.name}/x.svg` : `/${f.name}`,
    );
    for (const fichier of [...publics, "/icon.png", "/apple-icon.png", "/_next/static/x.js", "/widget/top10", "/api/public/v1/classement", "/robots.txt", "/sitemap.xml"]) {
      expect(passeParLeProxy(fichier), fichier).toBe(false);
    }
  });

  it("les pages passent par le proxy, même si leur adresse finit par .png", () => {
    for (const page of ["/", "/joueur/vipere", "/equipe/x.png", "/lol/tournois/coupe.svg", "/lol/divisions", "/connexion", "/moi/gains", "/robots.txt/x", "/robots.txt/", "/robots.txt.rsc", "/joueur/x.rsc", "/sitemap.xml.html", "/lol/sitemap.xml", "/x/sitemap.xml"]) {
      expect(passeParLeProxy(page), page).toBe(true);
    }
  });
});
