import { describe, expect, it } from "vitest";
import { planifier, type TournoiSuivi } from "./planification";
import type { Creneau } from "./creneaux";

const CRENEAU: Creneau = {
  cle: "quotidien-21h",
  nom: "Najarena Daily",
  heure: "21:00",
  checkinMinutes: 30,
  capacite: 16,
  bestOf: 1,
  region: "EUW",
  minimumJoueurs: 4,
};

// 24/09/2026 (heure d'été) : début 21:00 Paris = 19:00 UTC, check-in
// 20:30 Paris = 18:30 UTC.
const DEBUT_24 = "2026-09-24T19:00:00.000Z";
const CHECKIN_24 = "2026-09-24T18:30:00.000Z";
const DEBUT_25 = "2026-09-25T19:00:00.000Z";

function tournoi(partiel: Partial<TournoiSuivi> = {}): TournoiSuivi {
  return {
    id: "t1",
    statut: "ouvert",
    debute_le: DEBUT_24,
    checkin_ouvre_le: CHECKIN_24,
    creneau_auto: CRENEAU.cle,
    rappels: [],
    ...partiel,
  };
}

const existant25 = tournoi({ id: "t25", debute_le: DEBUT_25, checkin_ouvre_le: "2026-09-25T18:30:00.000Z" });

describe("création", () => {
  it("le matin, crée le tournoi du soir et celui du lendemain", () => {
    const actions = planifier(new Date("2026-09-24T08:00:00Z"), [], [CRENEAU]);
    expect(actions).toEqual([
      { type: "creer", creneau: CRENEAU.cle, jour: "2026-09-24", debuteLe: DEBUT_24, checkinOuvreLe: CHECKIN_24 },
      {
        type: "creer",
        creneau: CRENEAU.cle,
        jour: "2026-09-25",
        debuteLe: DEBUT_25,
        checkinOuvreLe: "2026-09-25T18:30:00.000Z",
      },
    ]);
  });

  it("ne recrée jamais un tournoi qui existe déjà, quel que soit son statut", () => {
    const actions = planifier(
      new Date("2026-09-24T08:00:00Z"),
      [tournoi({ statut: "annule" }), existant25],
      [CRENEAU],
    );
    expect(actions.filter((a) => a.type === "creer")).toEqual([]);
  });

  it("ne crée pas le tournoi du soir si son check-in est déjà ouvert", () => {
    const actions = planifier(new Date("2026-09-24T18:40:00Z"), [existant25], [CRENEAU]);
    expect(actions.filter((a) => a.type === "creer")).toEqual([]);
  });
});

describe("check-in et rappels", () => {
  it("le matin : rien (ni annonce ni rappel)", () => {
    const actions = planifier(new Date("2026-09-24T08:00:00Z"), [tournoi(), existant25], [CRENEAU]);
    expect(actions).toEqual([]);
  });

  it("à 15:00 (6 h avant) : annonce du tournoi du jour sur le salon Discord", () => {
    const actions = planifier(new Date("2026-09-24T13:00:00Z"), [tournoi(), existant25], [CRENEAU]);
    expect(actions).toEqual([{ type: "rappel", tournoiId: "t1", rappel: "annonce" }]);
  });

  it("annonce déjà faite : rien avant l'ouverture du check-in", () => {
    const actions = planifier(
      new Date("2026-09-24T18:00:00Z"),
      [tournoi({ rappels: ["annonce"] }), existant25],
      [CRENEAU],
    );
    expect(actions).toEqual([]);
  });

  it("tournoi d'organisateur : jamais d'annonce (déjà annoncé à sa création)", () => {
    const actions = planifier(
      new Date("2026-09-24T18:00:00Z"),
      [tournoi({ creneau_auto: null }), existant25],
      [CRENEAU],
    );
    // (le tournoi automatique du soir, absent de la liste, serait créé)
    expect(actions.filter((a) => a.type !== "creer")).toEqual([]);
  });

  it("à l'ouverture : passe en check-in et envoie le premier rappel", () => {
    const actions = planifier(new Date("2026-09-24T18:31:00Z"), [tournoi(), existant25], [CRENEAU]);
    expect(actions).toEqual([
      { type: "ouvrir_checkin", tournoiId: "t1" },
      { type: "rappel", tournoiId: "t1", rappel: "checkin_ouvert" },
    ]);
  });

  it("premier rappel déjà envoyé : rien jusqu'au dernier appel", () => {
    const actions = planifier(
      new Date("2026-09-24T18:45:00Z"),
      [tournoi({ statut: "checkin", rappels: ["checkin_ouvert"] }), existant25],
      [CRENEAU],
    );
    expect(actions).toEqual([]);
  });

  it("10 minutes avant le début : dernier appel", () => {
    const actions = planifier(
      new Date("2026-09-24T18:51:00Z"),
      [tournoi({ statut: "checkin", rappels: ["checkin_ouvert"] }), existant25],
      [CRENEAU],
    );
    expect(actions).toEqual([{ type: "rappel", tournoiId: "t1", rappel: "dernier_appel" }]);
  });

  it("tâche en retard : jamais deux rappels d'un coup, seul le dernier appel part", () => {
    const actions = planifier(new Date("2026-09-24T18:55:00Z"), [tournoi(), existant25], [CRENEAU]);
    expect(actions).toEqual([
      { type: "ouvrir_checkin", tournoiId: "t1" },
      { type: "rappel", tournoiId: "t1", rappel: "dernier_appel" },
    ]);
  });

  it("check-in trop court pour deux rappels (organisateur, 12 min) : un seul rappel", () => {
    const court = tournoi({
      creneau_auto: null,
      checkin_ouvre_le: "2026-09-24T18:48:00.000Z",
    });
    const actions = planifier(new Date("2026-09-24T18:55:00Z"), [court, existant25], [CRENEAU]);
    expect(actions).toEqual([
      { type: "ouvrir_checkin", tournoiId: "t1" },
      { type: "rappel", tournoiId: "t1", rappel: "checkin_ouvert" },
    ]);
  });

  it("tournoi d'organisateur : check-in et rappels, mais jamais de démarrage automatique", () => {
    const organisateur = tournoi({ creneau_auto: null, statut: "checkin", rappels: ["checkin_ouvert", "dernier_appel"] });
    const actions = planifier(new Date("2026-09-24T19:30:00Z"), [organisateur, existant25], [CRENEAU]);
    expect(actions).toEqual([]);
  });

  it("tournoi d'organisateur encore « ouvert » après l'heure : passe en check-in, sans rappel", () => {
    const organisateur = tournoi({ creneau_auto: null });
    const actions = planifier(new Date("2026-09-24T19:30:00Z"), [organisateur, existant25], [CRENEAU]);
    expect(actions).toEqual([{ type: "ouvrir_checkin", tournoiId: "t1" }]);
  });

  it("brouillon, en cours, terminé ou annulé : jamais touché", () => {
    const actions = planifier(
      new Date("2026-09-24T18:55:00Z"),
      (["brouillon", "en_cours", "termine", "annule"] as const).map((statut, i) =>
        tournoi({ id: `t${i}`, statut }),
      ).concat(existant25),
      [CRENEAU],
    );
    expect(actions).toEqual([]);
  });
});

describe("démarrage des tournois automatiques", () => {
  it("à l'heure du début : démarrage", () => {
    const actions = planifier(
      new Date("2026-09-24T19:02:00Z"),
      [tournoi({ statut: "checkin", rappels: ["checkin_ouvert", "dernier_appel"] }), existant25],
      [CRENEAU],
    );
    expect(actions).toEqual([{ type: "demarrer", tournoiId: "t1" }]);
  });

  it("encore « ouvert » à l'heure du début (étape manquée) : démarrage direct, sans rappel", () => {
    const actions = planifier(new Date("2026-09-24T19:02:00Z"), [tournoi(), existant25], [CRENEAU]);
    expect(actions).toEqual([{ type: "demarrer", tournoiId: "t1" }]);
  });

  it("plus de 2 h de retard : annulation plutôt qu'un démarrage devant personne", () => {
    const actions = planifier(
      new Date("2026-09-24T21:05:00Z"),
      [tournoi({ statut: "checkin" }), existant25],
      [CRENEAU],
    );
    expect(actions).toEqual([{ type: "annuler_retard", tournoiId: "t1" }]);
  });
});
