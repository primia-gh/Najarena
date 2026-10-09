#!/usr/bin/env node
// Crée la clé de signature des certificats de niveau (idée en réserve n°2).
// À lancer une fois :
//
//   node scripts/generer-cle-certificats.mjs
//
// Copier la ligne CERTIFICATS_CLE_PRIVEE=… dans les variables
// d'environnement de Vercel (Production), jamais dans le dépôt : qui détient
// cette clé peut signer des certificats au nom de Najarena. La clé publique
// affichée en dessous sera publiée automatiquement par le site
// (/api/public/v1/cle-certificats).
// Changer de clé un jour : garder l'ancienne clé publique dans
// CERTIFICATS_CLES_ANCIENNES (séparées par des virgules), pour que les
// certificats déjà émis restent vérifiables.

import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ed25519");
const jwk = privateKey.export({ format: "jwk" });
const enBase64 = (b64url) => Buffer.from(b64url, "base64url").toString("base64");

console.log(`CERTIFICATS_CLE_PRIVEE=${enBase64(jwk.d)}`);
console.log(`Clé publique (à titre d'information) : ${enBase64(jwk.x)}`);
