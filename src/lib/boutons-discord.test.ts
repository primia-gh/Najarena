import { describe, expect, it } from "vitest";
import {
  composantsDiscord,
  horodatageRecent,
  idBouton,
  lireIdBouton,
  messageRefusBouton,
  messageReussiteBouton,
} from "./boutons-discord";

const ID = "94700000-0000-0000-0000-000000000001";

describe("idBouton / lireIdBouton", () => {
  it("relit l'identifiant qu'il a écrit", () => {
    expect(lireIdBouton(idBouton("checkin", ID))).toEqual({ action: "checkin", cible: ID });
    expect(lireIdBouton(idBouton("revanche", ID))).toEqual({ action: "revanche", cible: ID });
    expect(idBouton("pret", ID).length).toBeLessThanOrEqual(100);
  });

  it("refuse tout bouton qui n'est pas l'un des nôtres", () => {
    expect(lireIdBouton(undefined)).toBeNull();
    expect(lireIdBouton("supprimer:" + ID)).toBeNull();
    expect(lireIdBouton("checkin:pas-un-identifiant")).toBeNull();
    expect(lireIdBouton(`checkin:${ID}:en-trop`)).toBeNull();
    expect(lireIdBouton("checkin")).toBeNull();
  });
});

describe("composantsDiscord", () => {
  it("met les boutons sur une ligne, suivis du lien vers le site", () => {
    const lignes = composantsDiscord(
      [
        { action: "defi_oui", cible: ID, libelle: "Accepter" },
        { action: "defi_non", cible: ID, libelle: "Refuser", style: "danger" },
      ],
      { libelle: "Ouvrir sur Najarena", url: "https://najarena.example/moi#defis" },
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0].components).toEqual([
      { type: 2, style: 1, label: "Accepter", custom_id: `defi_oui:${ID}` },
      { type: 2, style: 4, label: "Refuser", custom_id: `defi_non:${ID}` },
      { type: 2, style: 5, label: "Ouvrir sur Najarena", url: "https://najarena.example/moi#defis" },
    ]);
  });

  it("passe à la ligne au-delà de 5 boutons ; lien seulement vers une adresse https", () => {
    const six = Array.from({ length: 6 }, () => ({ action: "pret" as const, cible: ID, libelle: "Prêt" }));
    expect(composantsDiscord(six).map((l) => l.components.length)).toEqual([5, 1]);
    expect(composantsDiscord([], { libelle: "Lien", url: "javascript:alert(1)" })).toEqual([]);
    // Adresse locale (développement) : Discord refuserait tout le message.
    expect(composantsDiscord([], { libelle: "Lien", url: "http://localhost:3000/moi" })).toEqual([]);
  });
});

describe("horodatageRecent", () => {
  const maintenant = 1_760_000_000_000;
  it("accepte un clic signé il y a moins de 5 minutes", () => {
    expect(horodatageRecent(String(maintenant / 1000 - 60), maintenant)).toBe(true);
  });
  it("refuse un clic rejoué plus tard, ou sans heure valable", () => {
    expect(horodatageRecent(String(maintenant / 1000 - 301), maintenant)).toBe(false);
    expect(horodatageRecent(null, maintenant)).toBe(false);
    expect(horodatageRecent("hier", maintenant)).toBe(false);
  });
});

describe("messages", () => {
  it("traduit les refus de la base selon le bouton", () => {
    expect(messageRefusBouton("checkin", "CHECKIN_FERME")).toContain("check-in n'est pas ouvert");
    expect(messageRefusBouton("pret", "MATCH_NON_OUVERT")).toBe("Ce match n'est plus à jouer.");
    expect(messageRefusBouton("defi_oui", "DEFI_EXPIRE")).toBe("Ce défi a expiré.");
    expect(messageRefusBouton("revanche", "NON_PARTICIPANT")).toBe("Tu n'as pas joué ce duel.");
    expect(messageRefusBouton("pret", "COMPTE_DISCORD_INCONNU")).toContain("aucun compte Najarena");
    expect(messageRefusBouton("checkin", "panne")).toContain("Impossible");
  });

  it("décrit ce que le clic a fait", () => {
    expect(messageReussiteBouton("checkin", { ok: true })).toBe("Présence confirmée.");
    expect(messageReussiteBouton("checkin", { ok: false })).toBeNull();
    expect(messageReussiteBouton("pret", { nouveau: true })).toContain("15 minutes");
    expect(messageReussiteBouton("pret", { nouveau: false })).toBe("Tu étais déjà déclaré prêt.");
    expect(messageReussiteBouton("pret", { nouveau: true }, { adversairePret: true })).toContain("tous les deux");
    expect(messageReussiteBouton("revanche", { ok: true }, { adversaire: "Bob" })).toContain("à Bob");
  });
});
