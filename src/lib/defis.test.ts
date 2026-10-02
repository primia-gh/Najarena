import { describe, expect, it } from "vitest";
import { etatDefi, messageRefusDefi } from "./defis";

describe("défis", () => {
  const maintenant = new Date("2026-10-01T20:00:00Z");

  it("un défi proposé reste en attente jusqu'à son expiration", () => {
    expect(etatDefi("propose", "2026-10-01T20:00:01Z", maintenant)).toBe("en_attente");
    expect(etatDefi("propose", "2026-10-01T20:00:00Z", maintenant)).toBe("expire");
  });

  it("une réponse fait foi, même après l'heure d'expiration", () => {
    expect(etatDefi("accepte", "2026-09-30T00:00:00Z", maintenant)).toBe("accepte");
    expect(etatDefi("refuse", "2026-09-30T00:00:00Z", maintenant)).toBe("refuse");
    expect(etatDefi("annule", "2026-10-02T00:00:00Z", maintenant)).toBe("annule");
  });

  it("traduit les refus de la base, et garde un message par défaut sinon", () => {
    expect(messageRefusDefi('new row ... "REGION_DIFFERENTE"', "?")).toMatch(/même région/);
    expect(messageRefusDefi("ADVERSAIRE_SANS_COMPTE_RIOT", "?")).toMatch(/compte Riot vérifié/);
    expect(messageRefusDefi("erreur réseau", "Réessaie.")).toBe("Réessaie.");
  });
});
