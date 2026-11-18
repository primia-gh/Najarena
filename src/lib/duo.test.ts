import { describe, expect, it } from "vitest";
import { compatibilite, messageRefusDuo, propositionsDuo, raisonsCompatibilite, type AnnonceDuo } from "./duo";

const moi: AnnonceDuo = {
  profileId: "moi",
  poste: "adc",
  postesCherches: ["support"],
  creneaux: ["semaine_soir", "weekend_soir"],
  objectif: "classees",
  rating: 1600,
};

function annonce(id: string, champs: Partial<AnnonceDuo>): AnnonceDuo {
  return {
    profileId: id,
    poste: "support",
    postesCherches: ["adc"],
    creneaux: ["semaine_soir"],
    objectif: "classees",
    rating: null,
    ...champs,
  };
}

describe("compatibilité d'un duo", () => {
  it("écarte un joueur dont le poste n'est pas cherché, ou sans créneau commun, ou soi-même", () => {
    expect(compatibilite(moi, annonce("a", { poste: "mid" }))).toBeNull();
    expect(compatibilite(moi, annonce("b", { creneaux: ["semaine_journee"] }))).toBeNull();
    expect(compatibilite(moi, { ...moi })).toBeNull();
  });

  it("repère les postes réciproques, les créneaux communs et le même objectif", () => {
    const c = compatibilite(moi, annonce("c", { creneaux: ["weekend_soir", "semaine_soir", "semaine_nuit"] }));
    expect(c).not.toBeNull();
    expect(c!.reciproque).toBe(true);
    expect(c!.creneauxCommuns).toEqual(["semaine_soir", "weekend_soir"]);
    expect(c!.memeObjectif).toBe(true);
    expect(c!.ecart).toBeNull();
  });

  it("ne donne un écart de niveau que si les deux joueurs sont classés", () => {
    expect(compatibilite(moi, annonce("d", { rating: 1680 }))!.ecart).toBe(80);
    expect(compatibilite({ ...moi, rating: null }, annonce("e", { rating: 1680 }))!.ecart).toBeNull();
  });

  it("classe d'abord la réciprocité, puis le niveau proche ; pénalise un niveau très éloigné", () => {
    const proche = annonce("proche", { rating: 1650 });
    const loin = annonce("loin", { rating: 2300 });
    const unSens = annonce("un-sens", { postesCherches: ["mid"], rating: 1610 });
    const inconnu = annonce("inconnu", {});
    const ordre = propositionsDuo(moi, [unSens, loin, inconnu, proche]).map((p) => p.annonce.profileId);
    expect(ordre).toEqual(["proche", "inconnu", "un-sens", "loin"]);
  });

  it("à score égal, le plus petit écart connu passe devant, puis l'annonce la plus récente", () => {
    const a = annonce("a", { rating: 1690 });
    const b = annonce("b", { rating: 1610 });
    const c = annonce("c", { rating: 1620 });
    expect(propositionsDuo(moi, [a, c, b]).map((p) => p.annonce.profileId)).toEqual(["b", "c", "a"]);
  });
});

describe("raisons affichées", () => {
  it("décrit ce qui fonde l'appariement, sans rien inventer", () => {
    const autre = annonce("r", { rating: 1650, creneaux: ["semaine_soir", "weekend_soir"] });
    const raisons = raisonsCompatibilite(moi, autre, compatibilite(moi, autre)!);
    expect(raisons[0]).toMatch(/Postes complémentaires : Support et ADC/);
    expect(raisons[1]).toMatch(/2 créneaux en commun : semaine · soir, week-end · soir/);
    expect(raisons[2]).toMatch(/Même objectif/);
    expect(raisons[3]).toMatch(/Niveaux proches : 50 points/);
  });

  it("signale un niveau éloigné et omet l'écart d'un joueur non classé", () => {
    const loin = annonce("l", { rating: 2200, objectif: "loisir" });
    expect(raisonsCompatibilite(moi, loin, compatibilite(moi, loin)!).at(-1)).toMatch(/Niveaux éloignés : 600 points/);
    const nonClasse = annonce("n", { objectif: "loisir" });
    expect(raisonsCompatibilite(moi, nonClasse, compatibilite(moi, nonClasse)!)).toHaveLength(2);
  });
});

describe("messages de refus", () => {
  it("traduit les refus de la base", () => {
    expect(messageRefusDuo("DEMANDE_REFUSEE_RECEMMENT", "?")).toMatch(/30 jours/);
    expect(messageRefusDuo('new row "ANNONCE_REQUISE"', "?")).toMatch(/Publie d'abord/);
    expect(messageRefusDuo("erreur réseau", "Réessaie.")).toBe("Réessaie.");
  });
});
