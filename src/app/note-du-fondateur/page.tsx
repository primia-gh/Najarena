import type { Metadata } from "next";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Une note du fondateur — Najarena",
  description: "Pourquoi Najarena existe.",
};

export default function NoteDuFondateurPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-3xl px-gouttiere">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">
            Pourquoi Najarena
          </span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text">
            Une note du fondateur.
          </h1>
        </Apparition>

        <Apparition delai={0.1}>
          <div className="mt-8 flex flex-col gap-4 text-[0.95rem] leading-relaxed">
            <p className="text-text">
              J&apos;ai commencé Najarena parce que j&apos;étais fatigué d&apos;une chose précise : finir un
              tournoi amateur et devoir croire quelqu&apos;un sur parole pour le résultat. Une capture
              d&apos;écran, un screenshot flou, un &laquo;&nbsp;fais-moi confiance&nbsp;&raquo; — sur un jeu où
              chaque partie est déjà enregistrée quelque part, officiellement, ça n&apos;avait aucun sens.
            </p>
            <p className="text-muted">
              Najarena part d&apos;une seule règle : un résultat n&apos;est vrai que s&apos;il peut être
              vérifié dans la donnée du jeu lui-même. Pas déclaré. Pas arbitré à l&apos;amiable. Vérifié.
              C&apos;est plus lent à construire que de simplement laisser les joueurs entrer un score — mais
              c&apos;est la seule version qui donne un classement en lequel on peut vraiment croire.
            </p>
            <p className="text-muted">
              Le site est encore jeune. Il n&apos;a pas encore accueilli de vrai tournoi public. Mais tout ce
              qui y est construit l&apos;est déjà avec cette contrainte en tête, dès la première ligne de code
              — pas ajoutée après coup.
            </p>
          </div>

          <div className="mt-8 border-t border-line pt-5 font-texte tabular-nums text-[0.78rem] text-muted">
            — Le fondateur de Najarena
          </div>
        </Apparition>
      </div>
    </main>
  );
}
