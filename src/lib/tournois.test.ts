import { describe, expect, it } from "vitest";
import { formaterDate, grouperTournois, partiesDate } from "./tournois";

describe("formaterDate", () => {
  it("affiche l'heure de Paris, quel que soit le fuseau du serveur", () => {
    // 19:00 UTC le 27/09 = 21:00 à Paris (heure d'été).
    expect(formaterDate("2026-09-27T19:00:00Z")).toBe("27/09 21:00");
  });

  it("heure d'hiver : 20:00 UTC = 21:00 à Paris", () => {
    expect(formaterDate("2026-12-10T20:00:00Z")).toBe("10/12 21:00");
  });
});

describe("partiesDate", () => {
  it("découpe la date en heure de Paris", () => {
    expect(partiesDate("2026-10-05T19:00:00Z")).toEqual({ jourSemaine: "lun.", jour: "05", mois: "oct.", heure: "21:00" });
  });

  it("minuit à Paris reste 00:00, pas 24:00", () => {
    expect(partiesDate("2026-10-05T22:00:00Z").heure).toBe("00:00");
  });
});

describe("grouperTournois", () => {
  const t = (id: string, statut: "ouvert" | "checkin" | "en_cours" | "termine" | "annule", debute_le: string) => ({ id, statut, debute_le });

  it("en direct, puis à venir du plus proche au plus lointain, puis terminés du plus récent au plus ancien", () => {
    const g = grouperTournois([
      t("fini-ancien", "termine", "2026-10-01T19:00:00Z"),
      t("loin", "ouvert", "2026-10-09T19:00:00Z"),
      t("direct", "en_cours", "2026-10-05T17:00:00Z"),
      t("proche", "checkin", "2026-10-05T19:00:00Z"),
      t("fini-recent", "termine", "2026-10-04T19:00:00Z"),
      t("annule", "annule", "2026-10-02T19:00:00Z"),
    ]);
    expect(g.enDirect.map((x) => x.id)).toEqual(["direct"]);
    expect(g.aVenir.map((x) => x.id)).toEqual(["proche", "loin"]);
    expect(g.termines.map((x) => x.id)).toEqual(["fini-recent", "fini-ancien"]);
    expect(g.annules.map((x) => x.id)).toEqual(["annule"]);
  });
});
