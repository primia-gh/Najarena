import type { Metadata } from "next";
import Link from "next/link";
import { URL_PUBLIQUE } from "@/lib/donnees-publiques";
import { RAFRAICHISSEMENT_WIDGET_SECONDES } from "@/lib/widgets";
import FondEcailles from "@/components/design/FondEcailles";
import EnTetePage from "@/components/design/EnTetePage";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import BoutonCopier from "@/components/design/BoutonCopier";

// Widgets et API publique (03/10/2026, audit N31) : mode d'emploi pour les
// équipes, les créateurs de contenu et les streamers.

export const metadata: Metadata = {
  title: "Widgets et API — Najarena",
  description:
    "Intègre un bracket, le top 10, la carte CV d'un joueur ou l'overlay de ton match sur ton site ou ton stream, ou lis les données publiques de Najarena en JSON.",
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
    texte: "Rating et palier une fois le joueur classé, sinon son indice de confiance ; nombre de matchs 1v1 vérifiés (comme sur le CV).",
    hauteur: 170,
  },
];

// Bloc de code qui défile : atteignable au clavier (tabIndex + role region).
const CLASSE_CODE =
  "overflow-x-auto rounded-bouton border border-line bg-bg p-3 text-xs text-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Overlay de match (21/11/2026) : adresses à coller dans OBS, pas des iframes.
const OVERLAYS = [
  {
    titre: "Le match d'un joueur, toujours à jour",
    chemin: "/widget/joueur/ADRESSE-DU-PROFIL/match?fond=transparent",
    texte:
      "Suit le match du moment d'un joueur, d'un tournoi à l'autre : tournois, défis, arène et matchs de son équipe en 5v5. Le résultat reste affiché 15 minutes, puis le match suivant prend sa place. Pour commenter un match, mets l'adresse du profil de l'un des deux joueurs, la fin du lien de son CV.",
    lienMoi: true,
  },
  {
    titre: "Un match précis",
    chemin: "/widget/match/IDENTIFIANT-DU-MATCH?fond=transparent",
    texte:
      "Pour revenir sur un match joué : l'identifiant est la fin du lien de sa fiche de preuve, ouverte depuis le badge du verdict sur la page du tournoi.",
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
      "Résumé du CV : classé ou non, rating et palier (seulement une fois classé), confiance, matchs joués et matchs 1v1 vérifiés (comme sur le CV).",
  },
  {
    chemin: "/api/public/v1/joueurs/ADRESSE-DU-PROFIL/recalcul",
    texte:
      "De quoi refaire le calcul de ses points : ses lignes du registre, ses matchs avec leur verdict (et, depuis le 22/11/2026, niveau_compte_min : le niveau Riot du moins avancé des deux comptes, sous 30 le match ne compte pas), et le rating et le RD de départ de ses adversaires dans chaque tournoi (page /joueur/ADRESSE-DU-PROFIL/recalcul).",
  },
  {
    chemin: "/api/public/v1/tournois/ADRESSE-DU-TOURNOI",
    texte:
      "Un tournoi et son bracket : participants, scores, gagnant, niveau du verdict (verifie = lu chez Riot, faux pour une décision manuelle), tableau en double élimination (gagnants, perdants, finale).",
  },
  {
    chemin: "/api/public/v1/certificats/CODE-DU-CERTIFICAT",
    texte:
      "Un certificat de niveau signé : texte exact signé (contenu), signature et clé publique (Ed25519, base64), état de la signature. Seul celui qui a reçu le code peut le lire.",
  },
  {
    chemin: "/api/public/v1/cle-certificats",
    texte:
      "Les clés publiques qui signent les certificats (l'actuelle d'abord). Programme de vérification autonome : /certificat/verifier-certificat.mjs.",
  },
];

export default function DeveloppeursPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille *:max-w-3xl">
        <EnTetePage
          surtitre="Développeurs · streamers"
          titre="Widgets et API"
          intro="Affiche les résultats vérifiés de Najarena sur le site de ton équipe ou sur ton stream, ou lis-les en JSON. Gratuit, sans clé, en lecture seule : uniquement ce qui est déjà public sur le site."
        />

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
                    <h3 className="font-semibold">{w.titre}</h3>
                    <p className="text-sm text-muted">{w.texte}</p>
                    <pre tabIndex={0} role="region" aria-label={`Code du widget ${w.titre}`} className={CLASSE_CODE}>
                      <code>{code}</code>
                    </pre>
                    <BoutonCopier texte={code} libelle="Copier le code" className="self-start" />
                  </Panneau>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="overlay" className="flex scroll-mt-28 flex-col gap-4">
          <LibelleSection as="h2" id="overlay">
            Overlay de match pour ton stream
          </LibelleSection>
          <p className="text-sm text-muted">
            Une bannière avec les deux joueurs (ou les deux équipes), l&apos;étape du tournoi et l&apos;état du match,
            puis le vainqueur et la source du verdict. Dans OBS, ajoute une source « Navigateur » avec l&apos;adresse
            ci-dessous, en 1280 × 200 pixels. Pas de score en direct : le résultat s&apos;affiche une fois lu chez Riot,
            en général quelques minutes après la partie, ou marqué « manuel » s&apos;il a été tranché par
            l&apos;organisateur.
          </p>
          <ul className="flex flex-col gap-4">
            {OVERLAYS.map((o) => {
              const adresse = `${URL_PUBLIQUE}${o.chemin}`;
              return (
                <li key={o.chemin}>
                  <Panneau className="flex flex-col gap-3 p-5">
                    <h3 className="font-semibold">{o.titre}</h3>
                    <p className="text-sm text-muted">{o.texte}</p>
                    {"lienMoi" in o && (
                      <Link
                        href="/moi#moi-overlay"
                        className="inline-flex min-h-11 items-center self-start text-sm text-text underline underline-offset-3 hover:text-accent"
                      >
                        Ton adresse toute prête, dans ton tableau de bord
                      </Link>
                    )}
                    <pre tabIndex={0} role="region" aria-label={`Adresse : ${o.titre}`} className={CLASSE_CODE}>
                      <code>{adresse}</code>
                    </pre>
                    <BoutonCopier texte={adresse} libelle="Copier l'adresse" className="self-start" />
                    <p className="text-xs text-muted">Remplace ensuite le texte en majuscules par la bonne adresse.</p>
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
