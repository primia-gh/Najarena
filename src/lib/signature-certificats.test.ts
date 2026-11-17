import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import { enBase64, etatSignature, lirePaireCles, signerTexte, verifierTexte } from "./signature-certificats";

const graine = new Uint8Array(32).fill(7);
const paire = nacl.sign.keyPair.fromSeed(graine);
const texte = "najarena-certificat-v1\ncode: abc123\nrating: 1780.00";

describe("lirePaireCles", () => {
  it("lit une clé de 64 octets ou sa graine de 32, en base64", () => {
    expect(enBase64(lirePaireCles(enBase64(paire.secretKey))!.publique)).toBe(enBase64(paire.publicKey));
    expect(enBase64(lirePaireCles(enBase64(graine))!.publique)).toBe(enBase64(paire.publicKey));
  });
  it("ignore une valeur absente ou de mauvaise taille", () => {
    expect(lirePaireCles(undefined)).toBeNull();
    expect(lirePaireCles("abc")).toBeNull();
  });
});

describe("signature", () => {
  const signature = signerTexte(texte, paire.secretKey);
  const cle = enBase64(paire.publicKey);

  it("se vérifie avec la clé publique", () => {
    expect(signature).toMatch(/^[A-Za-z0-9+/]{86}==$/);
    expect(cle).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(verifierTexte(texte, signature, cle)).toBe(true);
  });

  it("ne se vérifie plus si une seule lettre du certificat change", () => {
    expect(verifierTexte(texte.replace("1780", "1980"), signature, cle)).toBe(false);
  });

  it("donne l'état affiché sur la page du certificat", () => {
    expect(etatSignature(texte, signature, cle, [cle])).toBe("valide");
    expect(etatSignature(texte.replace("abc", "abd"), signature, cle, [cle])).toBe("invalide");
    expect(etatSignature(texte, signature, cle, [])).toBe("cle_inconnue");
    expect(etatSignature(texte, null, null, [cle])).toBe("absente");
  });
});
