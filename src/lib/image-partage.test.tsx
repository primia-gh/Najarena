import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ImageResponse } from "next/og";
import {
  ContenuAfficheTournoi,
  ContenuCarteProfil,
  ContenuIntrouvable,
  ressourcesImage,
  type AfficheTournoi,
  type CarteProfil,
} from "./image-partage";

// Le générateur d'images est strict (mise en page, polices) : une erreur ne
// se verrait qu'au premier partage d'un lien. On génère donc chaque image
// avec des données d'exemple. APERCU_IMAGES=dossier pour les enregistrer.
async function rendre(element: React.ReactElement, nom: string): Promise<Buffer> {
  const { options } = await ressourcesImage();
  const reponse = new ImageResponse(element, options);
  const png = Buffer.from(await reponse.arrayBuffer());
  if (process.env.APERCU_IMAGES) await writeFile(`${process.env.APERCU_IMAGES}/${nom}.png`, png);
  return png;
}

const carte: CarteProfil = {
  pseudo: "Viper Main",
  slug: "viper-main",
  compteVerifie: true,
  rating: 1724,
  estClasse: true,
  confiance: 100,
  palier: { nom: "Platine", ratingMin: 1600 },
  matchsVerifies: 34,
  victoires: 21,
};

const affiche: AfficheTournoi = {
  slug: "najarena-daily-28-09",
  nom: "Najarena Daily",
  format: "1v1",
  capacite: 16,
  region: "EUW",
  statut: "termine",
  debuteLe: "2026-09-28T19:00:00Z",
  bestOf: 3,
  vainqueur: "Viper Main",
};

// Bracket à 16 joueurs : les trois derniers tours sont dessinés, avec un
// match encore à jouer et des noms d'équipe trop longs.
const bracket16: AfficheTournoi["bracket"] = [];
for (let tour = 1; tour <= 4; tour++) {
  for (let position = 1; position <= 2 ** (4 - tour); position++) {
    bracket16.push({
      tour,
      position,
      joueurs: [`Joueur ${tour}-${position}a`, tour === 3 && position === 2 ? "[BRN] Les Barons du mardi soir" : `Joueur ${tour}-${position}b`],
      gagnant: tour === 4 ? null : 0,
    });
  }
}

function estPng(png: Buffer): boolean {
  return png.subarray(1, 4).toString("ascii") === "PNG";
}

describe("images de partage", () => {
  it("dessine la carte CV, vérifiée ou non, classée ou non", async () => {
    const { logo } = await ressourcesImage();
    expect(estPng(await rendre(<ContenuCarteProfil carte={carte} logo={logo} />, "carte-cv"))).toBe(true);
    const debutant: CarteProfil = { ...carte, pseudo: "Joueur-1a2b3c4d", compteVerifie: false, rating: null, estClasse: false, confiance: 0, palier: null, matchsVerifies: 0, victoires: 0 };
    expect(estPng(await rendre(<ContenuCarteProfil carte={debutant} logo={logo} />, "carte-cv-debutant"))).toBe(true);
  }, 30_000);

  it("dessine la carte d'un certificat de niveau daté", async () => {
    const { logo } = await ressourcesImage();
    const png = await rendre(
      <ContenuCarteProfil carte={carte} logo={logo} rubrique="CERTIFICAT DE NIVEAU · 28/09/2026" chemin="/certificat/1a2b3c4d5e6f" />,
      "certificat",
    );
    expect(estPng(png)).toBe(true);
  }, 30_000);

  it("dessine l'affiche d'un tournoi, avec un nom long", async () => {
    const { logo } = await ressourcesImage();
    expect(estPng(await rendre(<ContenuAfficheTournoi affiche={affiche} logo={logo} />, "affiche-tournoi"))).toBe(true);
    const long: AfficheTournoi = { ...affiche, nom: "Coupe d'automne des Barons du mardi soir — édition 2", statut: "ouvert", vainqueur: null, bestOf: 1 };
    expect(estPng(await rendre(<ContenuAfficheTournoi affiche={long} logo={logo} />, "affiche-tournoi-long"))).toBe(true);
    expect(estPng(await rendre(<ContenuIntrouvable logo={logo} rubrique="TOURNOI" titre="TOURNOI INTROUVABLE" chemin="/lol/tournois" />, "introuvable"))).toBe(true);
  }, 30_000);

  it("dessine le bracket d'un tournoi lancé ou terminé", async () => {
    const { logo } = await ressourcesImage();
    const enCours: AfficheTournoi = { ...affiche, statut: "en_cours", vainqueur: null, bracket: bracket16 };
    expect(estPng(await rendre(<ContenuAfficheTournoi affiche={enCours} logo={logo} />, "affiche-bracket-en-cours"))).toBe(true);
    const termine: AfficheTournoi = {
      ...affiche,
      nom: "Coupe d'automne des Barons",
      bracket: bracket16.map((m) => (m.tour === 4 ? { ...m, gagnant: 1 } : m)),
      vainqueur: "Joueur 4-1b",
    };
    expect(estPng(await rendre(<ContenuAfficheTournoi affiche={termine} logo={logo} />, "affiche-bracket-termine"))).toBe(true);
    const duel: AfficheTournoi = {
      ...affiche,
      capacite: 2,
      bracket: [{ tour: 1, position: 1, joueurs: ["Viper Main", "Ahri Only"], gagnant: 0 }],
    };
    expect(estPng(await rendre(<ContenuAfficheTournoi affiche={duel} logo={logo} />, "affiche-bracket-duel"))).toBe(true);
  }, 30_000);
});
