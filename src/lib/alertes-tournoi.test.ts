import { describe, expect, it } from "vitest";
import { dateLisibleParis, lireReglageAlertes, messageAlerte, messageRefusAlertes, resumeAlertes } from "./alertes-tournoi";

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
    expect(resumeAlertes(["weekend_soir", "semaine_soir"], ["5v5", "1v1"])).toEqual({
      creneaux: "Semaine · soir, Week-end · soir",
      formats: "1v1 et 5v5",
    });
  });
  it("traduit les refus de la base", () => {
    expect(messageRefusAlertes("COMPTE_RIOT_REQUIS", "x")).toMatch(/Riot ID/);
    expect(messageRefusAlertes("autre chose", "défaut")).toBe("défaut");
  });
  it("message d'alerte : nom, format, serveur, et comment couper", () => {
    const m = messageAlerte({ nom: "Coupe du soir", debute_le: "2026-11-21T19:00:00Z", format: "1v1", region: "EUW" });
    expect(m.titre).toBe("Un tournoi pour toi — Coupe du soir");
    // Espaces insécables posées par typographie() : comparées comme des espaces.
    const texte = m.texte.replace(/\u00a0/g, " ");
    expect(texte).toMatch(/^Tournoi 1v1 sur EUW, samedi 21 novembre à 20 h, ouvert à toi/);
    expect(texte).toMatch(/rubrique « Tournois pour toi »/);
    expect(m.texte).toContain("«\u00a0Tournois pour toi\u00a0»");
    const cinq = messageAlerte({ nom: "Coupe", debute_le: "2026-11-21T19:00:00Z", format: "5v5", region: "EUW" });
    expect(cinq.texte.replace(/\u00a0/g, " ")).toMatch(/inscris ton équipe ou entre en agent libre/);
  });
});

describe("dateLisibleParis", () => {
  it("heure ronde, heure de Paris (hiver)", () => {
    expect(dateLisibleParis("2026-11-21T19:00:00Z")).toBe("samedi 21 novembre à 20\u00a0h");
  });
  it("avec minutes, heure d'été", () => {
    expect(dateLisibleParis("2026-07-04T16:30:00Z")).toBe("samedi 4 juillet à 18\u00a0h\u00a030");
  });
});
