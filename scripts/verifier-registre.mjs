#!/usr/bin/env node
// Vérification indépendante du registre des points de Najarena
// (28/09/2026, audit N8). N'utilise rien du site : seulement Node.js et le
// registre public téléchargé depuis /registre/export.
//
//   node scripts/verifier-registre.mjs https://<domaine>/registre/export
//   node scripts/verifier-registre.mjs registre.json
//
// Chaque ligne est scellée par l'empreinte SHA-256 de son contenu et de
// l'empreinte de la ligne précédente (64 zéros pour la première). Contenu,
// dans cet ordre, séparé par « | » : numéro, empreinte précédente, joueur,
// jeu, saison, match, tournoi, motif, rating avant, RD avant, rating après,
// RD après (2 décimales), adversaire, date en microsecondes depuis le
// 1er janvier 1970 UTC ; champ absent = chaîne vide. Si une seule ligne
// passée a été modifiée, son empreinte ne correspond plus — ni aucune des
// suivantes. Comparer la dernière empreinte avec celle publiée chaque soir
// sur le Discord de Najarena prouve que rien n'a changé depuis.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const GENESE = "0".repeat(64);

export function contenuScelle(ligne, precedente) {
  return [
    String(ligne.numero),
    precedente,
    ligne.profile_id,
    String(ligne.game_id),
    ligne.season_id,
    ligne.match_id ?? "",
    ligne.tournament_id ?? "",
    ligne.motif,
    ligne.rating_avant,
    ligne.rd_avant,
    ligne.rating_apres,
    ligne.rd_apres,
    ligne.adversaire_id ?? "",
    ligne.cree_le_us,
  ].join("|");
}

export function empreinte(contenu) {
  return createHash("sha256").update(contenu, "utf8").digest("hex");
}

/**
 * Vérifie la chaîne dans l'ordre des numéros. Renvoie le nombre de lignes,
 * la dernière empreinte et le numéro de la première ligne invalide (null
 * si la chaîne est intacte).
 */
export function verifierChaine(lignes) {
  const triees = [...lignes].sort((a, b) => Number(a.numero) - Number(b.numero));
  let precedente = GENESE;
  let rupture = null;
  triees.forEach((ligne, i) => {
    const attendue = empreinte(contenuScelle(ligne, precedente));
    if (
      rupture === null &&
      (Number(ligne.numero) !== i + 1 || ligne.empreinte_precedente !== precedente || ligne.empreinte !== attendue)
    ) {
      rupture = Number(ligne.numero);
    }
    precedente = ligne.empreinte;
  });
  return { lignes: triees.length, derniereEmpreinte: triees.length > 0 ? precedente : null, rupture };
}

async function charger(source) {
  if (/^https?:\/\//.test(source)) {
    const reponse = await fetch(source);
    if (!reponse.ok) throw new Error(`Téléchargement impossible (${reponse.status})`);
    return reponse.json();
  }
  return JSON.parse(await readFile(source, "utf8"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const source = process.argv[2];
  if (!source) {
    console.error("Usage : node scripts/verifier-registre.mjs <adresse ou fichier du registre>");
    process.exit(2);
  }
  const donnees = await charger(source);
  const lignes = Array.isArray(donnees) ? donnees : donnees.lignes;
  const { lignes: total, derniereEmpreinte, rupture } = verifierChaine(lignes);
  if (rupture !== null) {
    console.error(`ÉCHEC : la chaîne est rompue à la ligne ${rupture} (sur ${total}).`);
    process.exit(1);
  }
  console.log(`OK : ${total} lignes, chaîne intacte.`);
  console.log(`Dernière empreinte : ${derniereEmpreinte ?? "(registre vide)"}`);
}
