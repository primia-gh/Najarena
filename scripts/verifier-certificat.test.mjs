import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import { verifierCertificat } from "./verifier-certificat.mjs";

// Le script de vérification (Node seul) doit accepter exactement ce que
// signe le site (tweetnacl, src/lib/signature-certificats.ts).
const paire = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(3));
const cle = Buffer.from(paire.publicKey).toString("base64");
const contenu = "najarena-certificat-v1\ncode: 0123456789ab\nrating: 1780.00\npalier: Diamant";
const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(contenu), paire.secretKey)).toString("base64");

describe("verifierCertificat", () => {
  it("valide un certificat signé par une clé publiée", () => {
    expect(verifierCertificat({ contenu, signature, cle_publique: cle }, [cle])).toBe("valide");
  });

  it("détecte un contenu retouché, une clé non publiée, une signature absente", () => {
    expect(
      verifierCertificat({ contenu: contenu.replace("Diamant", "Champion"), signature, cle_publique: cle }, [cle]),
    ).toBe("invalide");
    expect(verifierCertificat({ contenu, signature, cle_publique: cle }, ["autre"])).toBe("cle_inconnue");
    expect(verifierCertificat({ contenu, signature: null, cle_publique: null }, [cle])).toBe("absente");
  });
});
