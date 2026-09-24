import type { Metadata } from "next";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import { JOURNAL } from "@/lib/journal";

export const metadata: Metadata = {
  title: "Journal de bord — Najarena",
  description: "Ce qui a été construit récemment sur Najarena, au fil de l'eau.",
};

export default function JournalPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-3xl px-gouttiere">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">
            En coulisses
          </span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text">
            Journal de bord.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-muted">
            Najarena avance publiquement. Voici ce qui a été construit récemment — pas de round de
            financement à annoncer, juste du produit qui sort.
          </p>
        </Apparition>

        <Apparition delai={0.1}>
          <div className="mt-10 flex flex-col">
            {JOURNAL.map((entree, i) => (
              <div
                key={entree.titre}
                className={`grid grid-cols-[100px_1fr] gap-5 py-6 ${
                  i < JOURNAL.length - 1 ? "border-b border-line" : ""
                } ${i === 0 ? "pt-0" : ""}`}
              >
                <div className="pt-0.5 font-texte tabular-nums text-[0.72rem] text-muted">{entree.date}</div>
                <div>
                  <h2 className="font-titre uppercase text-base font-extrabold text-text">{entree.titre}</h2>
                  <p className="mt-1.5 text-sm text-muted">{entree.texte}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entree.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-line bg-surface px-2 py-0.5 font-texte tabular-nums text-[0.6rem] tracking-[0.06em] text-muted uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Apparition>
      </div>
    </main>
  );
}
