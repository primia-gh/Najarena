import { describe, expect, it } from "vitest";
import { messageRefusModification } from "./modifier-tournoi";

describe("messageRefusModification", () => {
  it("traduit les codes de la base", () => {
    expect(messageRefusModification("INSCRIPTIONS_COMMENCEES")).toMatch(/déjà inscrit/);
    expect(messageRefusModification("CHECKIN_APRES_DEBUT")).toMatch(/check-in/);
    expect(messageRefusModification("LIMITE_ATTEINTE")).toMatch(/10 fois/);
  });

  it("reprend les messages de la modération pour le nom", () => {
    expect(messageRefusModification("NOM_INTERDIT")).not.toMatch(/Impossible/);
  });

  it("message générique pour une erreur inconnue", () => {
    expect(messageRefusModification("connection reset")).toBe("Impossible de modifier le tournoi pour l'instant.");
    expect(messageRefusModification(undefined)).toBe("Impossible de modifier le tournoi pour l'instant.");
  });
});
