import { describe, expect, it } from "vitest";
import { contenuScelle, empreinte, GENESE, verifierChaine } from "./verifier-registre.mjs";

// Ligne de référence scellée par la base (tests/sql/96-registre.sql) : le
// calcul de ce programme doit donner exactement la même empreinte.
const REFERENCE = {
  numero: 3,
  empreinte_precedente: "90e3dc014c01957db6a87c45ca17045a1c49a9cc611e222ef0827eeaa387d0ae",
  empreinte: "22facb62a2454882ea35b5a270dcd7a03439936b450aa370913f26a64f768b3f",
  profile_id: "00000000-0000-0000-0000-00000000000b",
  game_id: 1,
  season_id: "b902e955-0cdf-4da4-bc5c-b24c64fc99f9",
  match_id: null,
  tournament_id: "10000000-0000-0000-0000-000000000003",
  motif: "tournoi",
  rating_avant: "1500.00",
  rd_avant: "350.00",
  rating_apres: "1562.50",
  rd_apres: "290.12",
  adversaire_id: null,
  cree_le_us: "1790623800123456",
};

function chaine(n) {
  const lignes = [];
  let precedente = GENESE;
  for (let i = 1; i <= n; i++) {
    const ligne = { ...REFERENCE, numero: i, empreinte_precedente: precedente, rating_apres: `${1500 + i}.00` };
    ligne.empreinte = empreinte(contenuScelle(ligne, precedente));
    precedente = ligne.empreinte;
    lignes.push(ligne);
  }
  return lignes;
}

describe("vérification indépendante du registre", () => {
  it("retrouve l'empreinte calculée par la base", () => {
    expect(empreinte(contenuScelle(REFERENCE, REFERENCE.empreinte_precedente))).toBe(REFERENCE.empreinte);
  });

  it("valide une chaîne intacte et donne sa dernière empreinte", () => {
    const lignes = chaine(5);
    expect(verifierChaine(lignes)).toEqual({ lignes: 5, derniereEmpreinte: lignes[4].empreinte, rupture: null });
  });

  it("détecte une ligne passée retouchée, même sans toucher à son empreinte", () => {
    const lignes = chaine(5);
    lignes[1] = { ...lignes[1], rating_apres: "1900.00" };
    expect(verifierChaine(lignes).rupture).toBe(2);
  });

  it("détecte une ligne supprimée", () => {
    const lignes = chaine(5);
    lignes.splice(2, 1);
    expect(verifierChaine(lignes).rupture).toBe(4);
  });
});
