import type { Metadata } from "next";
import { BILAN_EXEMPLE, BUILDS_EXEMPLE, PSEUDO_EXEMPLE } from "@/lib/bilan-exemple";
import { chargerDonneesJeu } from "@/lib/ddragon";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import VueBilan from "@/components/bilan/VueBilan";

// Bilan d'exemple (05/10/2026) : un joueur fictif, des parties fictives,
// jamais en base (src/lib/bilan-exemple.ts) — montre le bilan complet
// avant qu'un joueur ait ses propres parties vérifiées. Même affichage que
// /moi/bilan, étiquette « Exemple » bien visible. Cette page n'interroge
// jamais Supabase.

export const metadata: Metadata = {
  title: "Bilan du joueur LoL : forces, axes de travail, builds — Najarena",
  description:
    "Exemple de bilan Najarena : tes forces et tes axes de travail mesurés sur tes parties vérifiées, ta progression partie par partie, tes champions et tes builds comparés à ceux des vainqueurs. Joueur et chiffres fictifs.",
  alternates: { canonical: "/lol/bilan" },
};

// Icônes du jeu relues une fois par jour (Data Dragon).
export const revalidate = 86400;

export default async function BilanExemplePage() {
  const donnees = await chargerDonneesJeu();
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        <Apparition>
          <p className="flex flex-wrap items-center gap-3 font-texte text-xs font-semibold tracking-[3px] uppercase">
            <span className="rounded-bouton bg-text px-2.5 py-1.5 text-on-accent">Exemple</span>
            <span className="text-muted">Joueur fictif · {PSEUDO_EXEMPLE}</span>
          </p>
          <h1 className="mt-6 font-titre text-section font-black tracking-[1px] uppercase">Le bilan du joueur</h1>
          <p className="mt-3 max-w-3xl text-courant text-text-2">
            Ce que disent tes parties vérifiées : tes forces, ce qui te coûte des victoires, et quoi travailler — avec les
            chiffres et le nombre de parties derrière chaque constat. Ci-dessous, le bilan d&apos;un joueur fictif sur 24
            parties au 1v1 : toutes les données de cette page sont inventées pour l&apos;exemple.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <BoutonLien href="/moi/bilan">Voir mon bilan</BoutonLien>
            <BoutonLien href="/lol/tournois" variante="secondaire">
              Jouer un tournoi
            </BoutonLien>
          </div>
        </Apparition>
        <VueBilan bilan={BILAN_EXEMPLE} builds={BUILDS_EXEMPLE} donnees={donnees} complet />
        <p className="max-w-3xl text-sm text-muted">
          Le bilan express (forces et axes de travail) est gratuit pour tous les joueurs. Le plan d&apos;entraînement, la
          progression, les champions et les builds font partie de l&apos;offre Elite.
        </p>
      </div>
    </main>
  );
}
