#!/usr/bin/env node
// Vérification indépendante d'un certificat de niveau Najarena (idée en
// réserve n°2). N'utilise rien du site : seulement Node.js.
//
//   node scripts/verifier-certificat.mjs https://<domaine>/api/public/v1/certificats/<code>
//   node scripts/verifier-certificat.mjs certificat.json [cle-publique-base64]
//
// Le certificat contient le texte exact signé (`contenu`), sa signature et
// la clé publique qui l'a signé (Ed25519, en base64). Le script vérifie que
// cette clé est bien l'une de celles que Najarena publie
// (/api/public/v1/cle-certificats, ou la clé passée en second argument),
// puis que la signature correspond au texte : une seule lettre changée et
// elle ne correspond plus.

import { createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";

/** La signature correspond-elle au texte, pour cette clé publique ? */
export function signatureValide(contenu, signature, clePublique) {
  try {
    const cle = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(clePublique, "base64").toString("base64url") },
      format: "jwk",
    });
    return verify(null, Buffer.from(contenu, "utf8"), cle, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/** « valide », « invalide », « cle_inconnue » ou « absente ». */
export function verifierCertificat(certificat, clesPubliees) {
  if (!certificat?.contenu || !certificat.signature || !certificat.cle_publique) return "absente";
  if (!clesPubliees.includes(certificat.cle_publique)) return "cle_inconnue";
  return signatureValide(certificat.contenu, certificat.signature, certificat.cle_publique) ? "valide" : "invalide";
}

async function lireJson(source) {
  if (/^https?:\/\//.test(source)) {
    const reponse = await fetch(source);
    if (!reponse.ok) throw new Error(`${source} : ${reponse.status}`);
    return reponse.json();
  }
  return JSON.parse(await readFile(source, "utf8"));
}

async function principal() {
  const [source, clePassee] = process.argv.slice(2);
  if (!source) {
    console.error("Usage : node scripts/verifier-certificat.mjs <adresse ou fichier du certificat> [clé publique]");
    process.exit(2);
  }
  const certificat = await lireJson(source);
  const cles = clePassee
    ? [clePassee]
    : /^https?:\/\//.test(source)
      ? (await lireJson(new URL("/api/public/v1/cle-certificats", source).toString())).cles ?? []
      : [];
  if (cles.length === 0) {
    console.error("Clé publique inconnue : passe-la en second argument, ou donne l'adresse du certificat.");
    process.exit(2);
  }

  console.log(certificat.contenu ?? "(pas de contenu)");
  console.log("");
  const etat = verifierCertificat(certificat, cles);
  const messages = {
    valide: "SIGNATURE VALIDE : ce certificat est celui que Najarena a émis, sans aucune modification.",
    invalide: "SIGNATURE INVALIDE : le contenu ne correspond plus à la signature.",
    cle_inconnue: "CLÉ INCONNUE : signé avec une clé que Najarena ne publie pas.",
    absente: "PAS DE SIGNATURE : certificat émis avant la signature numérique.",
  };
  console.log(messages[etat]);
  process.exit(etat === "valide" ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal().catch((erreur) => {
    console.error(erreur.message);
    process.exit(2);
  });
}
