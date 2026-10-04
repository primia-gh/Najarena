import type { Metadata } from "next";
import { URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { RAFRAICHISSEMENT_WIDGET_SECONDES } from "@/lib/widgets";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import BoutonCopier from "@/components/design/BoutonCopier";

// Widgets et API publique (03/10/2026, audit N31) : mode d'emploi pour les
// équipes, les créateurs de contenu et les streamers.

export const metadata: Metadata = {
  title: "Widgets et API — Najarena",
  description:
    "Intègre un bracket, le top 10 ou la carte CV d'un joueur sur ton site ou ton stream, ou lis les données publiques de Najarena en JSON.",
  alternates: { canonical: "/developpeurs" },
};

const WIDGETS = [
  {
    titre: "Bracket d'un tournoi",
    chemin: "/widget/bracket/ADRESSE-DU-TOURNOI",
    texte: "Le bracket en direct, scores et niveau de chaque verdict. L'adresse est la fin du lien du tournoi.",
    hauteur: 420,
  },
  {
    titre: "Top 10 du classement",
    chemin: "/widget/top10",
    texte: "Les dix meilleurs joueurs classés de la saison en cours.",
    hauteur: 380,
  },
  {
    titre: "Carte CV d'un joueur",
    chemin: "/widget/joueur/ADRESSE-DU-PROFIL",
    texte: "Rating et palier une fois le joueur classé, sinon son indice de confiance ; nombre de matchs vérifiés.",
    hauteur: 170,
  },
];

const POINTS_API = [
  {
    chemin: "/api/public/v1/classement?limite=25",
    texte:
      "Classement de la saison en cours (joueurs classés, 100 au plus) : rang, pseudo, adresse, rating, palier, matchs joués.",
  },
  {
    chemin: "/api/public/v1/joueurs/ADRESSE-DU-PROFIL",
    texte:
      "Résumé du CV : classé ou non, rating et palier (seulement une fois classé), confiance, matchs joués et vérifiés.",
  },
  {
    chemin: "/api/public/v1/tournois/ADRESSE-DU-TOURNOI",
    texte:
      "Un tournoi et son bracket : participants, scores, gagnant, niveau du verdict (verifie = lu chez Riot, faux pour une décision manuelle).",
  },
];

export default function DeveloppeursPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille *:max-w-3xl">
        <Apparition>
          <h1 className="font-titre text-section font-black tracking-[1px] uppercase">Widgets et API</h1>
          <p className="mt-3 text-courant text-text-2">
            Affiche les résultats vérifiés de Najarena sur le site de ton équipe ou sur ton stream, ou lis-les en JSON.
            Gratuit, sans clé, en lecture seule : uniquement ce qui est déjà public sur le site.
          </p>
        </Apparition>

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">Widgets</LibelleSection>
          <p className="text-sm text-muted">
            À coller dans une page (balise iframe). Ils se mettent à jour d&apos;eux-mêmes toutes les{" "}
            {RAFRAICHISSEMENT_WIDGET_SECONDES} secondes. Pour un overlay de stream (source « navigateur » d&apos;OBS),
            ajoute <code className="text-text">?fond=transparent</code> à l&apos;adresse.
          </p>
          <ul className="flex flex-col gap-4">
            {WIDGETS.map((w) => {
              const code = `<iframe src="${URL_PUBLIQUE}${w.chemin}" width="100%" height="${w.hauteur}" style="border:0" title="${w.titre} — Najarena"></iframe>`;
              return (
                <li key={w.chemin}>
                  <Panneau className="flex flex-col gap-3 p-5">
                    <p className="font-semibold">{w.titre}</p>
                    <p className="text-sm text-muted">{w.texte}</p>
                    <pre className="overflow-x-auto rounded-bouton border border-line bg-bg p-3 text-xs text-text-2">
                      <code>{code}</code>
                    </pre>
                    <BoutonCopier texte={code} libelle="Copier le code" className="self-start" />
                  </Panneau>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">API publique</LibelleSection>
          <p className="text-sm text-muted">
            Requêtes GET, réponses JSON, ouvertes à tous les sites (CORS). Les réponses sont gardées en cache une minute
            : inutile d&apos;interroger plus souvent.
          </p>
          <ul className="flex flex-col gap-3">
            {POINTS_API.map((p) => (
              <li key={p.chemin}>
                <Panneau className="flex flex-col gap-2 p-5">
                  <code className="text-sm break-all text-accent">GET {p.chemin}</code>
                  <p className="text-sm text-muted">{p.texte}</p>
                </Panneau>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <LibelleSection as="h2">Règles d&apos;usage</LibelleSection>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-text-2">
            <li>
              Cite la source : « Données Najarena », avec un lien vers la page concernée (les widgets le font déjà).
            </li>
            <li>
              Ne présente jamais un verdict manuel comme vérifié, ni un rating de joueur pas encore classé : l&apos;API
              ne le donne pas, ne le recalcule pas.
            </li>
            <li>
              Najarena n&apos;est ni produit ni approuvé par Riot Games : n&apos;utilise pas ses logos pour présenter
              ces données.
            </li>
            <li>Les adresses commençant par /api/public/v1 ne changeront pas sans préavis dans le journal de bord.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
