// Certificats signés (09/10/2026, idée en réserve n°2). Chaque certificat
// est signé à l'émission avec une clé secrète Ed25519 (algorithme de
// signature standard, celui des clés SSH modernes). La clé secrète vit
// seulement dans la variable d'environnement CERTIFICATS_CLE_PRIVEE (base64
// de la clé de 64 octets, ou de sa graine de 32 ; à créer avec
// `node scripts/generer-cle-certificats.mjs`), jamais en base ni dans le
// dépôt. La clé publique, elle, est publiée (/api/public/v1/cle-certificats)
// : n'importe qui vérifie un certificat sans Najarena
// (scripts/verifier-certificat.mjs). Sans clé configurée, les certificats
// sont émis comme avant, sans signature.
// CERTIFICATS_CLES_ANCIENNES : clés publiques d'avant un changement de clé,
// séparées par des virgules, pour que les anciens certificats restent
// vérifiables.

import nacl from "tweetnacl";

export interface PaireCles {
  publique: Uint8Array;
  secrete: Uint8Array;
}

/** Paire de clés lue dans une valeur base64 (clé de 64 octets ou graine de 32). */
export function lirePaireCles(valeur: string | undefined): PaireCles | null {
  if (!valeur) return null;
  try {
    const octets = Uint8Array.from(Buffer.from(valeur.trim(), "base64"));
    const paire =
      octets.length === 64
        ? nacl.sign.keyPair.fromSecretKey(octets)
        : octets.length === 32
          ? nacl.sign.keyPair.fromSeed(octets)
          : null;
    return paire ? { publique: paire.publicKey, secrete: paire.secretKey } : null;
  } catch {
    return null;
  }
}

export function paireClesServeur(): PaireCles | null {
  return lirePaireCles(process.env.CERTIFICATS_CLE_PRIVEE);
}

export function enBase64(octets: Uint8Array): string {
  return Buffer.from(octets).toString("base64");
}

/** Signature (base64) d'un texte : celui que produit contenu_certificat en base. */
export function signerTexte(texte: string, secrete: Uint8Array): string {
  return enBase64(nacl.sign.detached(new TextEncoder().encode(texte), secrete));
}

export function verifierTexte(texte: string, signature: string, clePublique: string): boolean {
  try {
    const sig = Uint8Array.from(Buffer.from(signature, "base64"));
    const cle = Uint8Array.from(Buffer.from(clePublique, "base64"));
    if (sig.length !== 64 || cle.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(texte), sig, cle);
  } catch {
    return false;
  }
}

/** Clés publiques de Najarena : l'actuelle, puis les anciennes. */
export function clesPubliees(): string[] {
  const actuelle = paireClesServeur();
  const anciennes = (process.env.CERTIFICATS_CLES_ANCIENNES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[A-Za-z0-9+/]{43}=$/.test(c));
  return [...(actuelle ? [enBase64(actuelle.publique)] : []), ...anciennes];
}

export type EtatSignature = "valide" | "invalide" | "cle_inconnue" | "absente";

/**
 * État de la signature d'un certificat : valide (signée par une clé publiée
 * de Najarena et conforme au texte), invalide, signée par une clé que
 * Najarena ne publie pas, ou absente (certificat émis sans clé).
 */
export function etatSignature(
  texte: string | null,
  signature: string | null,
  clePublique: string | null,
  cles: string[],
): EtatSignature {
  if (!signature || !clePublique || !texte) return "absente";
  if (!cles.includes(clePublique)) return "cle_inconnue";
  return verifierTexte(texte, signature, clePublique) ? "valide" : "invalide";
}
