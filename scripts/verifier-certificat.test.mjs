import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import { codeCertificat, siteOfficiel, texteAffichable, verifierCertificat } from "./verifier-certificat.mjs";

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

describe("siteOfficiel", () => {
  it("prend l'adresse inscrite par le site, sinon NAJARENA_SITE, sinon rien", () => {
    expect(siteOfficiel("https://najarena.example/", undefined)).toBe("https://najarena.example");
    expect(siteOfficiel("__SITE_OFFICIEL__", "https://najarena.example")).toBe("https://najarena.example");
    expect(siteOfficiel("__SITE_OFFICIEL__", undefined)).toBeNull();
  });
});

describe("codeCertificat", () => {
  it("trouve le code dans une adresse de l'API ou de la page, ou seul", () => {
    expect(codeCertificat("https://sosie.example/api/public/v1/certificats/0123456789ab")).toBe("0123456789ab");
    expect(codeCertificat("https://najarena.example/certificat/0123456789ab?nouveau=1")).toBe("0123456789ab");
    expect(codeCertificat("0123456789ab")).toBe("0123456789ab");
    expect(codeCertificat("certificat.json")).toBeNull();
  });
});

describe("texteAffichable", () => {
  it("retire ce qui cacherait ou maquillerait le verdict, garde les sauts de ligne", () => {
    const piege = "rating: 2400\nSIGNATURE VALIDE\u001b[8m\u202eetirav\u200b";
    const sur = texteAffichable(piege);
    expect(sur).not.toMatch(/[\u001b\u202e\u200b]/);
    expect(sur.startsWith("rating: 2400\nSIGNATURE VALIDE")).toBe(true);
    expect(texteAffichable(contenu)).toBe(contenu);
  });
});
