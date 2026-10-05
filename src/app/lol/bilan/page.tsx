import Link from "next/link";
import type { Metadata } from "next";
import {
  BILAN_CLASSEES_EXEMPLE,
  BILAN_EXEMPLE,
  BUILDS_CLASSEES_EXEMPLE,
  BUILDS_EXEMPLE,
  EXTRAS_CLASSEES_EXEMPLE,
  PSEUDO_EXEMPLE,
} from "@/lib/bilan-exemple";
import { chargerDonneesJeu } from "@/lib/ddragon";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import VueBilan from "@/components/bilan/VueBilan";

// Bilan d'exemple (05/10/2026) : un joueur fictif, des parties fictives,
// jamais en base (src/lib/bilan-exemple.ts) — montre le bilan complet
// avant qu'un joueur ait ses propres parties vérifiées. Même affichage que
// /moi/bilan, étiquette « Exemple » bien visible. Deux onglets : un bilan
// de tournois 1v1 et, depuis l'étape 2, un bilan de parties classées
// (niveau, hygiène de jeu, carte des morts, sang-froid). Cette page
// n'interroge jamais Supabase.

export const metadata: Metadata = {
  title: "Bilan du joueur LoL : forces, axes de travail, builds — Najarena",
  description:
    "Exemple de bilan Najarena : tes forces et tes axes de travail mesurés sur tes parties vérifiées, ta progression, tes champions et tes builds comparés à ceux des vainqueurs, et pour tes parties classées ton niveau, ton hygiène de jeu, la carte de tes morts et ton sang-froid. Joueur et chiffres fictifs.",
  alternates: { canonical: "/lol/bilan" },
};

interface BilanExemplePageProps {
  searchParams: Promise<{ format?: string }>;
}

export default async function BilanExemplePage({ searchParams }: BilanExemplePageProps) {
  const classees = (await searchParams).format === "classees";
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
            chiffres et le nombre de parties derrière chaque constat.{" "}
            {classees
              ? "Ci-dessous, le bilan des parties classées d'un joueur fictif (41 parties, rang Or, poste milieu), lues chez Riot avec son accord : "
              : "Ci-dessous, le bilan d'un joueur fictif sur 24 parties au 1v1 : "}
            toutes les données de cette page sont inventées pour l&apos;exemple.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <BoutonLien href={classees ? "/moi/bilan?format=classees" : "/moi/bilan"}>Voir mon bilan</BoutonLien>
            <BoutonLien href="/lol/tournois" variante="secondaire">
              Jouer un tournoi
            </BoutonLien>
          </div>
        </Apparition>
        <nav aria-label="Exemples de bilan" className="flex flex-wrap gap-2">
          {[
            { href: "/lol/bilan", libelle: "Tournois 1v1", actif: !classees },
            { href: "/lol/bilan?format=classees", libelle: "Classées", actif: classees },
          ].map((o) => (
            <Link
              key={o.href}
              href={o.href}
              aria-current={o.actif ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-bouton border px-4 font-texte text-sm font-semibold tracking-[2px] uppercase ${
                o.actif ? "border-accent text-accent" : "border-line-strong text-muted hover:text-text"
              }`}
            >
              {o.libelle}
            </Link>
          ))}
        </nav>
        {classees ? (
          <VueBilan
            bilan={BILAN_CLASSEES_EXEMPLE}
            builds={BUILDS_CLASSEES_EXEMPLE}
            donnees={donnees}
            complet
            extras={EXTRAS_CLASSEES_EXEMPLE}
          />
        ) : (
          <VueBilan bilan={BILAN_EXEMPLE} builds={BUILDS_EXEMPLE} donnees={donnees} complet />
        )}
        <p className="max-w-3xl text-sm text-muted">
          Le bilan express (forces et axes de travail) est gratuit pour tous les joueurs, sur leurs tournois comme sur
          leurs parties classées. Le plan d&apos;entraînement, la progression, les champions, les builds, le niveau,
          l&apos;hygiène de jeu, la carte des morts, le sang-froid et le bilan de la semaine sur Discord font partie de
          l&apos;offre Elite.
        </p>
      </div>
    </main>
  );
}
