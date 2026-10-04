import { describe, expect, it } from "vitest";
import { construireIcs } from "./agenda";

const ics = construireIcs({
  uid: "tournoi-123@najarena",
  titre: "Najarena Daily · 27/09, 1v1",
  debut: new Date("2026-09-27T19:00:00Z"),
  dureeMinutes: 150,
  description: "Check-in à 20:30 ; lien : https://najarena.vercel.app/lol/tournois/x",
  url: "https://najarena.vercel.app/lol/tournois/x",
  maintenant: new Date("2026-09-26T10:00:00Z"),
});

describe("construireIcs", () => {
  it("début et fin en UTC, rappel 30 min avant", () => {
    expect(ics).toContain("DTSTART:20260927T190000Z");
    expect(ics).toContain("DTEND:20260927T213000Z");
    expect(ics).toContain("TRIGGER:-PT30M");
  });

  it("échappe virgules et points-virgules, lignes terminées par CRLF", () => {
    expect(ics).toContain("SUMMARY:Najarena Daily · 27/09\\, 1v1");
    expect(ics).toContain("Check-in à 20:30 \\; lien");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
