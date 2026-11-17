#!/usr/bin/env node
// Vérification indépendante d'un certificat de niveau Najarena (idée en
// réserve n°2). N'utilise rien du site : seulement Node.js.
//
//   node verifier-certificat.mjs <code du certificat, ou son adresse>
//   node verifier-certificat.mjs certificat.json
//
// Le certificat contient le texte exact signé (`contenu`), sa signature et
// la clé publique qui l'a signé (Ed25519, en base64). Le script vérifie que
// cette clé est bien l'une de celles que Najarena publie, puis que la
// signature correspond au texte : une seule lettre changée et elle ne
// correspond plus.
//
// Certificat et clés sont toujours relus sur le site officiel de Najarena,
// jamais sur l'adresse donnée (contrôle de sécurité du 10/10/2026) : un
// site sosie pourrait sinon servir un faux certificat signé avec sa propre
// clé. L'adresse officielle est inscrite dans ce programme par le site qui
// le sert (/certificat/verifier-certificat.mjs) ; depuis le dépôt, la
// donner par NAJARENA_SITE=https://…

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

// Remplacé par l'adresse du site quand le site sert ce programme.
const SITE_INSCRIT = "__SITE_OFFICIEL__";

/** Origine du site officiel (https://domaine), ou null si elle est inconnue. */
export function siteOfficiel(inscrit = SITE_INSCRIT, variable = process.env.NAJARENA_SITE) {
  const brut = inscrit.startsWith("__") ? variable : inscrit;
  if (!brut) return null;
  try {
    return new URL(brut).origin;
  } catch {
    return null;
  }
}

/**
 * Texte sûr à afficher dans une fenêtre de commande : sans caractère de
 * contrôle (une séquence « ESC[8m » cacherait la suite, dont le verdict),
 * ni caractère invisible ou qui inverse le sens d'écriture. Les sauts de
 * ligne restent (contrôle de sécurité du 11/10/2026).
 */
export function texteAffichable(texte) {
  return String(texte).replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, "�");
}

/** Code d'un certificat (12 caractères), seul ou dans une adresse ; sinon null. */
export function codeCertificat(source) {
  const trouve = /(?:^|\/certificats?\/)([0-9a-f]{12})(?:$|[/?#])/.exec(source.trim());
  return trouve ? trouve[1] : null;
}

async function lireJson(adresse, introuvable) {
  const reponse = await fetch(adresse);
  if (reponse.status === 404 && introuvable) throw new Error(introuvable);
  if (!reponse.ok) throw new Error(`${adresse} : ${reponse.status}`);
  return reponse.json();
}

async function principal() {
  const [source] = process.argv.slice(2);
  if (!source) {
    console.error("Usage : node verifier-certificat.mjs <code ou adresse du certificat | certificat.json>");
    process.exit(2);
  }
  const site = siteOfficiel();
  if (!site) {
    console.error(
      "Adresse officielle de Najarena inconnue : télécharge ce programme depuis le site de Najarena, ou lance-le avec NAJARENA_SITE=https://…",
    );
    process.exit(2);
  }

  const estAdresse = /^https?:\/\//.test(source);
  const code = codeCertificat(source);
  if (estAdresse && new URL(source).origin !== site) {
    console.log(`ATTENTION : ${new URL(source).origin} n'est pas le site de Najarena (${site}).`);
    console.log("Le certificat est relu sur le site officiel ; ne te fie qu'à ce qui suit.");
    console.log("");
  }
  // Par son code, le certificat est relu sur le site officiel ; un fichier
  // est lu tel quel, mais sa clé doit être l'une de celles du site officiel.
  const depuisLeSite = Boolean(code);
  const certificat = depuisLeSite
    ? await lireJson(
        `${site}/api/public/v1/certificats/${code}`,
        `Aucun certificat ${code} sur ${site} : vérifie le code (12 caractères, chiffres et lettres de a à f).`,
      )
    : JSON.parse(await readFile(source, "utf8"));
  const cles = (await lireJson(`${site}/api/public/v1/cle-certificats`)).cles ?? [];

  // Le verdict d'abord, le texte ensuite : un texte piégé ne peut ni le
  // précéder d'un faux verdict, ni le cacher.
  const etat = verifierCertificat(certificat, cles);
  const messages = {
    valide: "SIGNATURE VALIDE : ce certificat est celui que Najarena a émis, sans aucune modification.",
    invalide: "SIGNATURE INVALIDE : le contenu ne correspond plus à la signature. Ne te fie pas à ce certificat.",
    cle_inconnue: "CLÉ INCONNUE : signé avec une clé que Najarena ne publie pas. Ne te fie pas à ce certificat.",
    absente: "PAS DE SIGNATURE : certificat émis avant la signature numérique.",
  };
  console.log(messages[etat]);
  // Le pseudo n'est pas dans le texte signé (seul l'identifiant interne du
  // joueur l'est) : on ne le montre que relu sur le site officiel.
  if (depuisLeSite && certificat.joueur?.slug) {
    console.log(
      texteAffichable(
        `Joueur, d'après le site officiel : ${certificat.joueur.pseudo} — ${site}/joueur/${certificat.joueur.slug}`,
      ),
    );
  } else if (!depuisLeSite) {
    console.log(`Le pseudo d'un fichier n'est pas signé : vérifie plutôt ce certificat par son code, sur ${site}.`);
  }
  console.log("");
  console.log(etat === "valide" ? "Texte signé :" : "Texte NON VÉRIFIÉ (ne t'y fie pas) :");
  console.log(texteAffichable(certificat.contenu ?? "(pas de contenu)"));
  console.log("");
  console.log(etat === "valide" ? "Résultat : VALIDE." : "Résultat : NON VALIDE.");
  process.exit(etat === "valide" ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal().catch((erreur) => {
    console.error(texteAffichable(erreur.message));
    process.exit(2);
  });
}
