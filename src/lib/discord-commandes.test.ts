import { describe, expect, it } from "vitest";
import { lienOrganiser, lireOption, peutGererServeur } from "./discord-commandes";

describe("peutGererServeur", () => {
  it("reconnaît « Gérer le serveur » et « Administrateur »", () => {
    expect(peutGererServeur(String(1 << 5))).toBe(true);
    expect(peutGererServeur(String(1 << 3))).toBe(true);
    expect(peutGererServeur("2147483647")).toBe(true);
    expect(peutGererServeur(String(1 << 10))).toBe(false);
    expect(peutGererServeur(undefined)).toBe(false);
    expect(peutGererServeur("abc")).toBe(false);
  });
});

describe("lireOption", () => {
  it("lit une option par son nom", () => {
    expect(lireOption([{ name: "code", value: "ABCD1234" }], "code")).toBe("ABCD1234");
    expect(lireOption([{ name: "places", value: 8 }], "places")).toBe("8");
    expect(lireOption(undefined, "code")).toBeUndefined();
  });
});

describe("lienOrganiser", () => {
  const site = "https://najarena.example";

  it("pré-remplit le formulaire, check-in 30 minutes avant", () => {
    const r = lienOrganiser(
      { nom: "Vendredi du club", jour: "05/10", heure: "20:30", places: "16", region: "EUW", communaute: "club" },
      "2026-10-03",
      site,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const url = new URL(r.lien);
    expect(url.pathname).toBe("/organiser/nouveau");
    expect(url.searchParams.get("debut")).toBe("2026-10-05T20:30");
    expect(url.searchParams.get("checkin")).toBe("2026-10-05T20:00");
    expect(url.searchParams.get("capacite")).toBe("16");
    expect(url.searchParams.get("region")).toBe("EUW");
    expect(url.searchParams.get("communaute")).toBe("club");
  });

  it("passe à l'année suivante pour une date déjà passée, et vérifie la date", () => {
    const r = lienOrganiser({ nom: "Nouvel an", jour: "02/01", heure: "0h15" }, "2026-10-03", site);
    expect(r.ok && new URL(r.lien).searchParams.get("checkin")).toBe("2027-01-01T23:45");
    expect(lienOrganiser({ nom: "Faux", jour: "31/02", heure: "20:00" }, "2026-10-03", site).ok).toBe(false);
    expect(lienOrganiser({ nom: "No", jour: "05/10", heure: "20:00" }, "2026-10-03", site).ok).toBe(false);
  });

  it("ignore une capacité ou une région inconnue", () => {
    const r = lienOrganiser(
      { nom: "Soirée", jour: "05/10", heure: "21:00", places: "7", region: "XX" },
      "2026-10-03",
      site,
    );
    expect(r.ok && new URL(r.lien).searchParams.has("capacite")).toBe(false);
    expect(r.ok && new URL(r.lien).searchParams.has("region")).toBe(false);
  });
});
