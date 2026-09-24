import type { Metadata } from "next";
import type { NiveauVerdict } from "@/lib/tournois";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import { CaseMatch, ColonnesBracket } from "@/components/tournoi/Bracket";
import {
  Deroulement,
  EnTeteTournoi,
  EssentielReglement,
  LegendeBracket,
  StatutTournoi,
} from "@/components/tournoi/BlocsTournoi";
import OngletsTournoi from "@/components/tournoi/OngletsTournoi";

export const metadata: Metadata = {
  title: "Exemple de tournoi — Najarena",
  description:
    "À quoi ressemble un tournoi Najarena du début à la fin : inscriptions, bracket, verdicts aux trois niveaux de preuve. Exemple illustratif, aucune vraie compétition.",
};

// Tournoi fictif, jamais en base — sert uniquement à montrer à quoi
// ressemble un bracket réel avant qu'il y ait eu un premier vrai tournoi
// public. Aucune donnée ici ne doit jamais compter dans les statistiques
// du site (accueil, admin) : contrairement au reste des pages preuve,
// cette page n'interroge jamais Supabase.
// Refonte « Venin » du 24/09/2026 : mêmes blocs que la vraie page tournoi
// (components/tournoi/), étiquette « Exemple » bien visible.
interface JoueurDemo {
  pseudo: string;
  score: number | null;
  gagnant: boolean;
}
interface MatchDemo {
  tour: number;
  joueurs: [JoueurDemo, JoueurDemo];
  niveau: NiveauVerdict;
  motif?: string;
}

const INSCRITS_DEMO = [
  "Ro2b", "Kesspa", "Nyxelia", "Faelune", "Drazko", "Wraithan", "Solvei", "Kaidrenn",
];

const MATCHS_DEMO: MatchDemo[] = [
  {
    tour: 1,
    joueurs: [
      { pseudo: "Ro2b", score: 1, gagnant: true },
      { pseudo: "Kesspa", score: 0, gagnant: false },
    ],
    niveau: "historique",
  },
  {
    tour: 1,
    joueurs: [
      { pseudo: "Nyxelia", score: 1, gagnant: true },
      { pseudo: "Faelune", score: 0, gagnant: false },
    ],
    niveau: "code_tournoi",
  },
  {
    tour: 1,
    joueurs: [
      { pseudo: "Drazko", score: null, gagnant: true },
      { pseudo: "Wraithan", score: null, gagnant: false },
    ],
    niveau: "manuel",
    motif: "Forfait — absent au check-in",
  },
  {
    tour: 1,
    joueurs: [
      { pseudo: "Solvei", score: 1, gagnant: true },
      { pseudo: "Kaidrenn", score: 0, gagnant: false },
    ],
    niveau: "historique",
  },
  {
    tour: 2,
    joueurs: [
      { pseudo: "Ro2b", score: 1, gagnant: true },
      { pseudo: "Nyxelia", score: 0, gagnant: false },
    ],
    niveau: "code_tournoi",
  },
  {
    tour: 2,
    joueurs: [
      { pseudo: "Drazko", score: 0, gagnant: false },
      { pseudo: "Solvei", score: 1, gagnant: true },
    ],
    niveau: "historique",
  },
  {
    tour: 3,
    joueurs: [
      { pseudo: "Ro2b", score: 1, gagnant: true },
      { pseudo: "Solvei", score: 0, gagnant: false },
    ],
    niveau: "code_tournoi",
  },
];

const NOM_TOUR: Record<number, string> = { 1: "Quarts", 2: "Demi-finales", 3: "Finale" };

export default function TournoiDemoPage() {
  const rounds = new Map<number, MatchDemo[]>();
  for (const m of MATCHS_DEMO) {
    const liste = rounds.get(m.tour) ?? [];
    liste.push(m);
    rounds.set(m.tour, liste);
  }
  const toursOrdonnes = Array.from(rounds.keys()).sort((a, b) => a - b);

  return (
    <main className="bg-bg font-texte text-text">
      <EnTeteTournoi
        nom="Najarena Cup"
        etiquettes={
          <>
            <span className="rounded-bouton bg-text px-2.5 py-1.5 text-on-accent">Exemple</span>
            <StatutTournoi statut="termine" />
            <span className="text-text-2">LoL · 1v1 · Élimination directe</span>
          </>
        }
        details={
          <>
            Tournoi d&apos;exemple, avec des noms fictifs — pas une vraie compétition. Il montre un bracket
            Najarena du premier tour à la finale, avec les trois niveaux de preuve possibles.
          </>
        }
        infos={[
          { libelle: "En jeu", valeur: "Exemple", grand: true, accent: false },
          { libelle: "Inscrits", valeur: "8/8", grand: true, accent: false },
          { libelle: "Format", valeur: "1v1 · BO1", grand: false, accent: false },
          { libelle: "Région", valeur: "EUW", grand: false, accent: false },
        ]}
        action={
          <BoutonLien href="/lol/tournois" className="w-full">
            Voir les vrais tournois
          </BoutonLien>
        }
      />

      <OngletsTournoi />

      <section id="bracket" className="scroll-mt-28 px-gouttiere pt-12">
        <div className="mx-auto flex max-w-contenu flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LibelleSection as="h2">Bracket</LibelleSection>
            <LegendeBracket avecLitige={false} />
          </div>
          <ColonnesBracket
            legende="Bracket du tournoi d'exemple"
            tours={toursOrdonnes.map((tour) => ({
              numero: tour,
              libelle: NOM_TOUR[tour],
              matchs: rounds.get(tour)!.map((m, i) => ({
                id: `${tour}-${i}`,
                joue: true,
                atteint: true,
                contenu: (
                  <CaseMatch
                    participants={m.joueurs.map((j) => ({
                      cle: j.pseudo,
                      pseudo: j.pseudo,
                      slug: null,
                      score: j.score,
                      estGagnant: j.gagnant,
                    }))}
                    etat="verdict"
                    niveau={m.niveau}
                    motif={m.motif}
                    monMatch={false}
                  />
                ),
              })),
            }))}
          />
        </div>
      </section>

      <section id="inscrits" className="scroll-mt-28 px-gouttiere pt-section-outil">
        <div className="mx-auto flex max-w-contenu flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LibelleSection as="h2">Inscrits</LibelleSection>
            <span className="text-xs text-muted tabular-nums">8 / 8 places</span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INSCRITS_DEMO.map((pseudo) => (
              <li key={pseudo} className="panneau flex items-center gap-3 px-4 py-3">
                <AvatarJoueur pseudo={pseudo} taille={34} />
                <span className="font-semibold">{pseudo}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-gouttiere pt-section-outil pb-24">
        <div className="mx-auto flex max-w-contenu flex-col gap-10">
          <div className="grid gap-8 md:grid-cols-2">
            <Deroulement
              etapes={[
                { titre: "Inscriptions", quand: "Terminées", etat: "fait" },
                { titre: "Check-in", quand: "Terminé", etat: "fait" },
                { titre: "Quarts", quand: "Terminé", etat: "fait" },
                { titre: "Demi-finales", quand: "Terminé", etat: "fait" },
                { titre: "Finale", quand: "Terminé", etat: "fait" },
              ]}
            />
            <EssentielReglement />
          </div>
          <p className="flex flex-wrap items-center gap-x-6 gap-y-3 text-text-2">
            Envie de voir ça avec ton propre nom dessus ?
            <BoutonLien href="/lol/tournois">Voir les tournois ouverts</BoutonLien>
          </p>
        </div>
      </section>
    </main>
  );
}
