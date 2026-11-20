import { describe, expect, it } from "vitest";
import { lireReglageAlertes, messageAlerte, messageRefusAlertes, resumeAlertes } from "./alertes-tournoi";

describe("lireReglageAlertes", () => {
  it("garde les créneaux et formats connus, sans doublon, dans l'ordre d'affichage", () => {
    const f = new FormData();
    for (const c of ["weekend_soir", "lundi_matin", "semaine_soir", "weekend_soir"]) f.append("creneaux", c);
    for (const x of ["5v5", "3v3", "1v1", "5v5"]) f.append("formats", x);
    expect(lireReglageAlertes(f)).toEqual({ creneaux: ["semaine_soir", "weekend_soir"], formats: ["1v1", "5v5"] });
  });
  it("rien de coché : listes vides (la base refuse)", () => {
    expect(lireReglageAlertes(new FormData())).toEqual({ creneaux: [], formats: [] });
  });
});

describe("textes", () => {
  it("résume le réglage", () => {
    expect(resumeAlertes(["weekend_soir", "semaine_soir"], ["1v1"])).toBe("Semaine · soir, Week-end · soir — 1v1");
  });
  it("traduit les refus de la base", () => {
    expect(messageRefusAlertes("COMPTE_RIOT_REQUIS", "x")).toMatch(/Riot ID/);
    expect(messageRefusAlertes("autre chose", "défaut")).toBe("défaut");
  });
  it("message d'alerte : nom, format, serveur, et comment couper", () => {
    const m = messageAlerte({ nom: "Coupe du soir", debute_le: "2026-11-21T19:00:00Z", format: "1v1", region: "EUW" });
    expect(m.titre).toBe("Un tournoi pour toi — Coupe du soir");
    expect(m.texte).toMatch(/^Tournoi 1v1 sur EUW, le /);
    expect(m.texte).toMatch(/à couper depuis ton compte/);
  });
});
