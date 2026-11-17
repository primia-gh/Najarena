import { describe, expect, it, vi } from "vitest";
import { cheminFichier, configAncrage, contenuFichier, deposerEmpreinte } from "./ancrage-github";

const empreinte = "ab".repeat(32);
const donnees = { jour: "2026-10-09", numero: 812, empreinte, site: "https://najarena.example" };

describe("configAncrage", () => {
  it("demande le dépôt et le jeton", () => {
    expect(configAncrage({})).toBeNull();
    expect(configAncrage({ GITHUB_ANCRAGE_DEPOT: "najarena/registre" })).toBeNull();
    expect(configAncrage({ GITHUB_ANCRAGE_DEPOT: "pas un dépôt", GITHUB_ANCRAGE_JETON: "x" })).toBeNull();
    expect(configAncrage({ GITHUB_ANCRAGE_DEPOT: "najarena/registre", GITHUB_ANCRAGE_JETON: "jeton" })).toEqual({
      depot: "najarena/registre",
      jeton: "jeton",
    });
  });
});

describe("fichier du jour", () => {
  it("un fichier par jour, rangé par mois", () => {
    expect(cheminFichier("2026-10-09")).toBe("registre/2026/10/2026-10-09.json");
    expect(JSON.parse(contenuFichier(donnees))).toEqual({
      registre: "Najarena — registre des points",
      jour: "2026-10-09",
      derniere_ligne: 812,
      empreinte,
      verifier: "https://najarena.example/registre",
    });
  });
});

describe("deposerEmpreinte", () => {
  const config = { depot: "najarena/registre", jeton: "jeton" };

  it("ne fait rien sans configuration", async () => {
    const envoyer = vi.fn();
    expect(await deposerEmpreinte(donnees, null, envoyer)).toBe("inactif");
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("dépose le fichier sans jamais en remplacer un", async () => {
    const envoyer = vi.fn(async () => new Response("{}", { status: 201 }));
    expect(await deposerEmpreinte(donnees, config, envoyer)).toBe("depose");
    const [adresse, options] = envoyer.mock.calls[0] as unknown as [string, RequestInit];
    expect(adresse).toBe("https://api.github.com/repos/najarena/registre/contents/registre/2026/10/2026-10-09.json");
    const corps = JSON.parse(String(options.body));
    expect(corps.sha).toBeUndefined();
    expect(Buffer.from(corps.content, "base64").toString("utf8")).toBe(contenuFichier(donnees));

    expect(await deposerEmpreinte(donnees, config, vi.fn(async () => new Response("{}", { status: 422 })))).toBe(
      "deja_depose",
    );
    expect(await deposerEmpreinte(donnees, config, vi.fn(async () => new Response("{}", { status: 401 })))).toBe("echec");
    expect(
      await deposerEmpreinte(donnees, config, vi.fn(async () => Promise.reject(new Error("réseau")))),
    ).toBe("echec");
  });
});
