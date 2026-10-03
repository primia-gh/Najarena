import { describe, expect, it } from "vitest";
import { recitTournoi, type MatchRecit } from "./recit-tournoi";

const m = (
  tour: number,
  a: [string, number | null],
  b: [string, number | null] | null,
  gagnant: string | null,
  niveau: "historique" | "manuel" = "historique",
): MatchRecit => ({
  tour,
  participants: [
    { id: a[0], pseudo: a[0].toUpperCase(), score: a[1] },
    ...(b ? [{ id: b[0], pseudo: b[0].toUpperCase(), score: b[1] }] : []),
  ],
  verdict: gagnant ? { niveau, gagnantId: gagnant } : null,
});

// Bracket de 4 : a bat b, c bat d, puis a bat c en finale (Bo3).
const bracket = [m(1, ["a", 2], ["b", 0], "a"), m(1, ["c", 2], ["d", 1], "c"), m(2, ["a", 2], ["c", 0], "a")];

describe("récit de tournoi", () => {
  it("raconte vainqueur, finale, parcours et vérification", () => {
    expect(recitTournoi({ nom: "Najarena Daily", nbJoueurs: 4, bestOf: 3, matchs: bracket })).toEqual([
      "A remporte Najarena Daily (4 joueurs) en battant C en finale, 2-0.",
      "Son parcours : B puis C, sans perdre une manche.",
      "Les 3 matchs ont été vérifiés dans la donnée officielle Riot.",
    ]);
  });

  it("parle d'équipes dans un tournoi 5v5", () => {
    const recit = recitTournoi({ nom: "Coupe 5v5", nbJoueurs: 4, bestOf: 1, matchs: bracket, equipes: true });
    expect(recit?.[0]).toBe("A remporte Coupe 5v5 (4 équipes) en battant C en finale, 2-0.");
  });

  it("n'écrit rien tant que la finale n'est pas décidée", () => {
    expect(recitTournoi({ nom: "X", nbJoueurs: 4, bestOf: 1, matchs: [bracket[0], bracket[1], m(2, ["a", null], ["c", null], null)] })).toBeNull();
  });

  it("signale l'exploit le plus improbable, jamais sur un verdict manuel", () => {
    const chances = (g: string) => (g === "c" ? 0.2 : g === "a" ? 0.6 : 0.5);
    const recit = recitTournoi({ nom: "Cup", nbJoueurs: 4, bestOf: 3, matchs: bracket, chances });
    expect(recit).toContain("Exploit du tournoi : C (20 % de chances estimées) élimine D en demi-finale.");

    const manuel = [bracket[0], m(1, ["c", null], ["d", null], "c", "manuel"), bracket[2]];
    const sansExploit = recitTournoi({ nom: "Cup", nbJoueurs: 4, bestOf: 3, matchs: manuel, chances });
    expect(sansExploit?.some((p) => p.startsWith("Exploit"))).toBe(false);
  });

  it("dit quand la finale a été tranchée à la main et combien de matchs ne comptent pas", () => {
    const recit = recitTournoi({
      nom: "Cup",
      nbJoueurs: 4,
      bestOf: 1,
      matchs: [bracket[0], bracket[1], m(2, ["a", null], ["c", null], "a", "manuel")],
    });
    expect(recit?.[0]).toBe(
      "A remporte Cup (4 joueurs) : la finale contre C a été tranchée par l'organisateur (verdict manuel, hors classement).",
    );
    expect(recit).toContain(
      "2 matchs sur 3 vérifiés dans la donnée officielle Riot ; l'autre, tranché à la main, ne compte pas au classement.",
    );
  });
});
