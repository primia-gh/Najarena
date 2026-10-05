import type { ReactNode } from "react";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import Icone, { type NomIcone } from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

// Cadre des pages de compte (connexion, inscription, mot de passe) — revue
// visuelle du 05/10/2026. Avant, chaque page posait son titre à 88 px dans
// une colonne de 448 px : « SE / CONNECTER » sur deux lignes, formulaire
// nu sur le fond. Désormais : titre à la taille d'un sous-titre (tient sur
// une ligne), formulaire dans un panneau, et sur grand écran (≥ 1024 px)
// un rappel de ce que le compte apporte — uniquement des choses vraies,
// reprises de l'accueil. L'ensemble reste centré (CLAUDE.md §7).

const PROMESSES: { icone: NomIcone; titre: string; texte: string }[] = [
  {
    icone: "bouclier",
    titre: "Résultats vérifiés",
    texte: "Les résultats sont lus dans la donnée officielle de Riot : les joueurs ne déclarent pas leur score.",
  },
  {
    icone: "coche",
    titre: "Rating officiel",
    texte: "Un classement national Glicko-2, recalculé à la fin de chaque tournoi classé.",
  },
  {
    icone: "joueur",
    titre: "CV e-sport",
    texte: "Ton profil public : rating, parcours et chaque résultat prouvé, match par match.",
  },
];

interface CadreCompteProps {
  /** Eyebrow au-dessus du titre, ex. « Compte joueur ». */
  libelle: string;
  titre: string;
  intro?: ReactNode;
  /** Colonne « ce que le compte apporte » sur grand écran (connexion, inscription). */
  promesses?: boolean;
  /** Message de réussite ou d'erreur (<Alerte>), posé au-dessus du formulaire. */
  alerte?: ReactNode;
  /** Sous le panneau : lien vers l'autre page (« Déjà un compte ? »). */
  pied?: ReactNode;
  children: ReactNode;
}

export default function CadreCompte({ libelle, titre, intro, promesses = false, alerte, pied, children }: CadreCompteProps) {
  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
        <div
          className={
            promesses
              ? "mx-auto grid w-full max-w-5xl items-center gap-16 lg:grid-cols-[minmax(0,1fr)_26rem]"
              : "mx-auto w-full max-w-md"
          }
        >
          {promesses && (
            <div className="hidden flex-col gap-10 lg:flex">
              <p className="font-titre text-sous-titre leading-none font-black uppercase">
                Ton niveau,
                <br />
                <span className="text-accent">vérifié.</span>
              </p>
              <ul className="flex flex-col gap-6 border-t border-line pt-8">
                {PROMESSES.map((p) => (
                  <li key={p.titre} className="flex gap-4">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-bouton border border-line-strong text-text">
                      <Icone nom={p.icone} taille={18} />
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="text-sm font-semibold tracking-[2px] uppercase">{p.titre}</span>
                      <span className="max-w-sm text-sm text-text-2">{p.texte}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Apparition className="w-full">
            <LibelleSection>{libelle}</LibelleSection>
            <h1 className="mt-3 font-titre text-[clamp(2.5rem,4.5vw,3.5rem)] leading-[0.9] font-black uppercase">
              {titre}
            </h1>
            {intro && <div className="mt-4 flex flex-col gap-1.5 text-sm text-text-2">{intro}</div>}
            {alerte && <div className="mt-6">{alerte}</div>}
            <Panneau className="mt-6 p-6 sm:p-7">{children}</Panneau>
            {pied && <p className="mt-6 text-sm text-muted">{pied}</p>}
          </Apparition>
        </div>
      </div>
    </main>
  );
}

/** Libellé + champ, empilés (pages de compte). */
export function ChampCompte({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-texte text-mini font-medium text-muted uppercase">{libelle}</span>
      {children}
    </label>
  );
}

/** Séparateur « ou » entre deux façons de se connecter. */
export function SeparateurOu() {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="font-texte text-mini font-medium text-muted uppercase">ou</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
