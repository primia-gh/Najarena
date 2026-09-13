import Link from "next/link";
import type { Metadata } from "next";
import { classeCarte, classeBoutonPrimaire } from "@/lib/ui";
import Badge from "@/components/ui/Badge";
import SectionTitre from "@/components/ui/SectionTitre";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";
import { LABEL_NIVEAU, COULEUR_NIVEAU, type NiveauVerdict } from "@/lib/tournois";

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
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
        <Reveal>
          <Link
            href="/lol/tournois"
            className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
          >
            ← Tournois
          </Link>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sceau/30 bg-sceau/10 px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.08em] text-sceau-texte uppercase">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                Exemple
              </span>
              <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-encre">
                Najarena Cup — démo
              </h1>
            </div>
          </div>

          <div className="mt-3 font-mono text-[0.78rem] text-ardoise">
            1v1 · 8 joueurs · EUW · terminé
          </div>

          <p className="mt-4 max-w-lg text-sm text-ardoise">
            Ceci est un tournoi d&apos;exemple, avec des noms fictifs — pas une vraie compétition. Il montre à
            quoi ressemble un bracket Najarena du premier tour à la finale, avec les trois niveaux de preuve
            possibles sur un même verdict.
          </p>
        </Reveal>

        <Reveal delai={0.1}>
          <section className="mt-10">
            <SectionTitre>Inscrits</SectionTitre>
            <ul className="mt-3 flex flex-wrap gap-2">
              {INSCRITS_DEMO.map((pseudo) => (
                <li
                  key={pseudo}
                  className="flex items-center gap-2 rounded-full border border-trait bg-carte py-1 pr-3 pl-1.5 text-sm text-encre"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sceau/16 font-display text-[0.68rem] font-extrabold text-sceau-texte"
                    aria-hidden="true"
                  >
                    {pseudo.charAt(0).toUpperCase()}
                  </span>
                  {pseudo}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal delai={0.15}>
          <section className="mt-10">
            <SectionTitre>Bracket</SectionTitre>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.78rem] text-ardoise">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-atteste" />
                Niveau 2/3 — compte pour le classement
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ardoise" />
                Niveau 1 — décision manuelle, hors classement
              </span>
            </div>

            <div className="mt-3 grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2">
              {toursOrdonnes.map((tour) => (
                <div key={tour} className="flex flex-col gap-3">
                  <span className="font-mono text-[0.64rem] tracking-[0.14em] text-ardoise uppercase">
                    {NOM_TOUR[tour]}
                  </span>
                  <ul className="flex flex-col gap-2">
                    {rounds.get(tour)!.map((m, i) => {
                      const accent =
                        m.niveau === "code_tournoi" || m.niveau === "historique" ? "atteste" : "ardoise";
                      return (
                        <li key={i} className={classeCarte(accent)}>
                          <div className="flex flex-col gap-1">
                            {m.joueurs.map((j) => (
                              <div key={j.pseudo} className="flex items-center justify-between">
                                <span className={j.gagnant ? "font-semibold text-encre" : "text-encre"}>
                                  {j.pseudo}
                                </span>
                                <span className="font-mono text-sm text-ardoise">{j.score ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2 border-t border-trait pt-2">
                            <Badge couleur={COULEUR_NIVEAU[m.niveau]}>{LABEL_NIVEAU[m.niveau]}</Badge>
                            {m.motif && <span className="text-[0.72rem] text-ardoise">{m.motif}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delai={0.2}>
          <p className="mt-10 text-sm text-ardoise">
            Envie de voir ça avec ton propre nom dessus ?{" "}
            <Link href="/lol/tournois" className={classeBoutonPrimaire() + " ml-1"}>
              Voir les tournois ouverts
            </Link>
          </p>
        </Reveal>
      </div>
    </main>
  );
}
