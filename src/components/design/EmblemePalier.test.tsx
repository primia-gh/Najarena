import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EmblemePalier, { clePalier, couleurPalier } from "./EmblemePalier";
import { SEUILS_PALIERS } from "@/lib/niveau-tournoi";
import { COULEUR_PALIER } from "@/lib/paliers";

// Emblèmes des paliers (26/11/2026) : les noms viennent de la base (table
// tiers) ; l'emblème et sa couleur doivent les reconnaître tous, et ne
// jamais deviner un palier pour un nom inconnu.

describe("clePalier", () => {
  it("reconnaît Écaille avec ou sans accent, en majuscules ou non", () => {
    expect(clePalier("Écaille")).toBe("ecaille");
    expect(clePalier("ÉCAILLE")).toBe("ecaille");
    expect(clePalier("ecaille")).toBe("ecaille");
  });

  it("reconnaît les six paliers de niveau-tournoi", () => {
    for (const p of SEUILS_PALIERS) expect(clePalier(p.nom)).not.toBeNull();
  });

  it("reconnaît toutes les clés de COULEUR_PALIER", () => {
    for (const k of Object.keys(COULEUR_PALIER)) expect(clePalier(k)).not.toBeNull();
  });

  it("ne devine rien pour un nom vide, ancien ou inattendu", () => {
    for (const nom of [null, undefined, "", "Diamant", " Mue ", "constructor", "toString"]) {
      expect(clePalier(nom)).toBeNull();
    }
  });
});

describe("couleurPalier", () => {
  it("trouve la couleur de chaque palier, Écaille comprise", () => {
    for (const p of SEUILS_PALIERS) {
      expect(couleurPalier(clePalier(p.nom))).toBe(COULEUR_PALIER[p.nom.toLowerCase()]);
    }
  });

  it("gris pour un joueur non classé", () => {
    expect(couleurPalier(null)).toBe("var(--color-faint)");
  });
});

describe("EmblemePalier", () => {
  it("décoratif par défaut, nommé sinon", () => {
    expect(renderToStaticMarkup(<EmblemePalier palier="Cobra" />)).toContain('aria-hidden="true"');
    const nomme = renderToStaticMarkup(<EmblemePalier palier="Cobra" decoratif={false} />);
    expect(nomme).toContain('role="img"');
    expect(nomme).toContain('aria-label="Palier Cobra"');
    expect(renderToStaticMarkup(<EmblemePalier palier={null} decoratif={false} />)).toContain('aria-label="Non classé"');
  });
});
