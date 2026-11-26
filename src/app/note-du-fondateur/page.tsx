import type { Metadata } from "next";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import EnTetePage from "@/components/design/EnTetePage";

export const metadata: Metadata = {
  // Adresse canonique (audit M11) : sans ses paramètres de filtre ou de message.
  alternates: { canonical: "/note-du-fondateur" },
  title: "Une note du fondateur — Najarena",
  description: "Pourquoi Najarena existe.",
};

export default function NoteDuFondateurPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille *:max-w-3xl">
        <EnTetePage surtitre="Pourquoi Najarena" titre="Une note du fondateur." />

        <Apparition delai={0.1}>
          {/* Texte de lecture en 17–20 px (revue visuelle du 09/10/2026). */}
          <div className="mt-10 flex flex-col gap-6 text-courant">
            <p className="text-text">
              J&apos;ai commencé Najarena parce que j&apos;étais fatigué d&apos;une chose précise : finir un
              tournoi amateur et devoir croire quelqu&apos;un sur parole pour le résultat. Une capture
              d&apos;écran, un screenshot flou, un &laquo;&nbsp;fais-moi confiance&nbsp;&raquo; — sur un jeu où
              chaque partie est déjà enregistrée quelque part, officiellement, ça n&apos;avait aucun sens.
            </p>
            <p className="text-text-2">
              Najarena part d&apos;une seule règle : un résultat n&apos;est vrai que s&apos;il peut être
              vérifié dans la donnée du jeu lui-même. Pas déclaré par les joueurs. Vérifié. Et quand la
              donnée ne suffit pas, la décision prise à la main est affichée comme telle, avec son motif,
              et ne compte jamais au classement. C&apos;est plus lent à construire que de simplement
              laisser les joueurs entrer un score — mais c&apos;est la seule version qui donne un
              classement en lequel on peut vraiment croire.
            </p>
            <p className="text-text-2">
              Le site est encore jeune. Mais tout ce qui y est construit l&apos;est avec cette contrainte
              en tête, dès la première ligne de code — pas ajoutée après coup.
            </p>
          </div>

          <div className="mt-10 border-t border-line pt-6 font-texte text-sm text-muted">
            — Le fondateur de Najarena
          </div>
        </Apparition>
      </div>
    </main>
  );
}
