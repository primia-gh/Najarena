import type { Metadata } from "next";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";
import { JOURNAL } from "@/lib/journal";

export const metadata: Metadata = {
  title: "Journal de bord — Najarena",
  description: "Ce qui a été construit récemment sur Najarena, au fil de l'eau.",
};

export default function JournalPage() {
  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-2xl px-6">
        <Reveal>
          <span className="block font-mono text-[0.66rem] tracking-[0.22em] text-ardoise uppercase">
            En coulisses
          </span>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
            Journal de bord.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-ardoise">
            Najarena avance publiquement. Voici ce qui a été construit récemment — pas de round de
            financement à annoncer, juste du produit qui sort.
          </p>
        </Reveal>

        <Reveal delai={0.1}>
          <div className="mt-10 flex flex-col">
            {JOURNAL.map((entree, i) => (
              <div
                key={entree.titre}
                className={`grid grid-cols-[100px_1fr] gap-5 py-6 ${
                  i < JOURNAL.length - 1 ? "border-b border-trait" : ""
                } ${i === 0 ? "pt-0" : ""}`}
              >
                <div className="pt-0.5 font-mono text-[0.72rem] text-ardoise">{entree.date}</div>
                <div>
                  <h2 className="font-display text-base font-extrabold text-encre">{entree.titre}</h2>
                  <p className="mt-1.5 text-sm text-ardoise">{entree.texte}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entree.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-trait bg-carte px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.06em] text-ardoise uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </main>
  );
}
