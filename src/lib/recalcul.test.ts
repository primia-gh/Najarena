import { describe, expect, it } from "vitest";
import { mettreAJourJoueur, VOLATILITE_INITIALE } from "./glicko2";
import { recalculer, type DonneesRecalcul, type MatchJoueur } from "./recalcul";

const MOI = "moi";
const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

function match(id: string, tournoi: string, adversaire: string, gagnant: string, quand: string, niveau = "historique", statut = "termine"): MatchJoueur {
  return { id, tournament_id: tournoi, statut, adversaire_id: adversaire, verdict: { niveau, gagnant_id: gagnant, cree_le: quand } };
}

/** Un historique de deux tournois, avec le registre que le serveur aurait écrit. */
function historique(): DonneesRecalcul {
  const departsT1 = { [MOI]: { rating_avant: 1500, rd_avant: 350 }, b: { rating_avant: 1600, rd_avant: 200 }, c: { rating_avant: 1450, rd_avant: 300 } };
  const t1 = mettreAJourJoueur({ rating: 1500, rd: 350, volatilite: VOLATILITE_INITIALE }, [
    { adversaire: { rating: 1600, rd: 200, volatilite: 0.06 }, score: 1 },
    { adversaire: { rating: 1450, rd: 300, volatilite: 0.06 }, score: 0 },
  ]);
  const avantT2 = { rating: r2(t1.rating), rd: r2(t1.rd), volatilite: r6(t1.volatilite) };
  const departsT2 = { [MOI]: { rating_avant: avantT2.rating, rd_avant: avantT2.rd }, d: { rating_avant: 1520, rd_avant: 250 } };
  const t2 = mettreAJourJoueur(avantT2, [{ adversaire: { rating: 1520, rd: 250, volatilite: 0.06 }, score: 1 }]);
  return {
    profileId: MOI,
    lignes: [
      { numero: 4, motif: "tournoi", tournament_id: "T1", rating_avant: 1500, rd_avant: 350, rating_apres: r2(t1.rating), rd_apres: r2(t1.rd) },
      { numero: 9, motif: "tournoi", tournament_id: "T2", rating_avant: avantT2.rating, rd_avant: avantT2.rd, rating_apres: r2(t2.rating), rd_apres: r2(t2.rd) },
    ],
    matchs: [
      match("m1", "T1", "b", MOI, "2026-10-01T20:10:00Z"),
      match("m2", "T1", "c", "c", "2026-10-01T20:40:00Z"),
      match("m3", "T2", "d", MOI, "2026-10-02T20:10:00Z"),
      // Forfait et verdict manuel : jamais comptés.
      match("m4", "T2", "e", MOI, "2026-10-02T20:30:00Z", "historique", "forfait"),
      match("m5", "T2", "f", "f", "2026-10-02T20:50:00Z", "manuel"),
    ],
    departs: { T1: departsT1, T2: departsT2 },
  };
}

describe("recalculer", () => {
  it("retrouve exactement le registre, ligne par ligne", () => {
    const lignes = recalculer(historique());
    expect(lignes.map((l) => l.etat)).toEqual(["concorde", "concorde"]);
    expect(lignes.map((l) => l.detail)).toEqual(["2 matchs comptés", "1 match compté"]);
    expect(lignes.every((l) => l.continue)).toBe(true);
  });

  it("détecte une ligne retouchée et une rupture de continuité", () => {
    const d = historique();
    d.lignes[1] = { ...d.lignes[1], rating_apres: d.lignes[1].rating_apres + 25 };
    expect(recalculer(d)[1].etat).toBe("ecart");

    const d2 = historique();
    d2.lignes[1] = { ...d2.lignes[1], rating_avant: d2.lignes[1].rating_avant + 10 };
    expect(recalculer(d2)[1].continue).toBe(false);
  });

  it("ignore la 4e victoire en 24 h contre le même adversaire", () => {
    const d = historique();
    d.matchs.push(
      match("p1", "X", "d", MOI, "2026-10-02T10:00:00Z"),
      match("p2", "X", "d", MOI, "2026-10-02T12:00:00Z"),
      match("p3", "X", "d", MOI, "2026-10-02T14:00:00Z"),
    );
    // Trois victoires contre « d » juste avant : celle du tournoi T2 ne compte plus.
    expect(recalculer(d)[1].detail).toBe("0 match compté");
  });

  it("une correction ou un tournoi non précisé ne sont pas recalculables, sans fausse alerte", () => {
    const d = historique();
    d.lignes.push({ numero: 12, motif: "correction", tournament_id: null, rating_avant: 1, rd_avant: 1, rating_apres: 2, rd_apres: 2 });
    d.lignes.push({ numero: 13, motif: "tournoi", tournament_id: null, rating_avant: 2, rd_avant: 2, rating_apres: 3, rd_apres: 3 });
    const lignes = recalculer(d);
    expect(lignes[2].etat).toBe("non_verifiable");
    expect(lignes[3]).toMatchObject({ etat: "non_verifiable", detail: "Tournoi non précisé dans le registre" });
  });
});
