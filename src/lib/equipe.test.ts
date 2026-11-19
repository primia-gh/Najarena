import { describe, expect, it } from "vitest";
import { estLogoEquipeValide } from "./equipe";

const BASE = "https://abcd1234.supabase.co";
const EQUIPE = "20000000-0000-0000-0000-000000000002";

describe("logo d'équipe", () => {
  it("accepte une image déposée à l'emplacement de l'équipe", () => {
    expect(estLogoEquipeValide(`${BASE}/storage/v1/object/public/logos/equipe/${EQUIPE}.png`, EQUIPE, BASE)).toBe(true);
    expect(estLogoEquipeValide(`${BASE}/storage/v1/object/public/logos/equipe/${EQUIPE}.webp?v=1727500000000`, EQUIPE, BASE)).toBe(true);
  });

  it("refuse une adresse extérieure, une autre équipe ou un autre format", () => {
    expect(estLogoEquipeValide("https://pisteur.example/pixel.png", EQUIPE, BASE)).toBe(false);
    expect(estLogoEquipeValide(`${BASE}/storage/v1/object/public/logos/equipe/20000000-0000-0000-0000-000000000001.png`, EQUIPE, BASE)).toBe(false);
    expect(estLogoEquipeValide(`${BASE}/storage/v1/object/public/logos/equipe/${EQUIPE}.svg`, EQUIPE, BASE)).toBe(false);
    expect(estLogoEquipeValide(`${BASE}/storage/v1/object/public/logos/equipe/${EQUIPE}.png?x=1`, EQUIPE, BASE)).toBe(false);
  });

  it("refuse tout sans adresse Supabase configurée", () => {
    expect(estLogoEquipeValide(`${BASE}/storage/v1/object/public/logos/equipe/${EQUIPE}.png`, EQUIPE, undefined)).toBe(false);
  });
});

describe("nom d'équipe", () => {
  it("accepte les lettres latines accentuées, les chiffres et la ponctuation simple", async () => {
    const { estNomEquipeValide } = await import("./equipe");
    expect(estNomEquipeValide("L'Équipe d'Éva 2")).toBe(true);
    expect(estNomEquipeValide("Les Loups #1 (Paris)")).toBe(true);
    expect(estNomEquipeValide("Cœur & Âme")).toBe(true);
  });

  it("refuse les lettres sosies, les noms trop courts et « Agents libres »", async () => {
    const { estNomEquipeValide } = await import("./equipe");
    expect(estNomEquipeValide("Lеs Loups")).toBe(false); // « е » cyrillique
    expect(estNomEquipeValide("Les Ｌoups")).toBe(false); // L pleine largeur
    expect(estNomEquipeValide("XY")).toBe(false);
    expect(estNomEquipeValide("!!!")).toBe(false);
    expect(estNomEquipeValide("Agents Libres 3")).toBe(false);
    expect(estNomEquipeValide("x".repeat(41))).toBe(false);
  });
});
