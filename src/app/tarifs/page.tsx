import Link from "next/link";
import type { Metadata } from "next";
import { demarrerAbonnement } from "@/lib/stripe-actions";
import { ORDRE_OFFRE, type Offre } from "@/lib/offres";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";

export const metadata: Metadata = {
  title: "Tarifs — Najarena",
  description:
    "Les paliers Najarena : le classement, les verdicts et le profil public restent gratuits pour toujours. Vérifié, Elite et Organisateur ajoutent de l'identité et du confort, jamais un péage sur la preuve.",
};

interface Palier {
  nom: string;
  cle?: Exclude<Offre, "gratuit">;
  prix: string;
  periode?: string;
  accroche: string;
  inclus: string[];
  cta: { libelle: string; href?: string };
}

interface TarifsPageProps {
  searchParams: Promise<{ erreur?: string; message?: string; pour?: string }>;
}

type Profil = "joueur" | "organiser";

// Avantages annoncés mais pas encore codés (vérifié le 18/09/2026 : aucune
// logique ne les applique). Affichés « Bientôt » plutôt que vendus comme
// livrés — à retirer de cette liste au fur et à mesure de leur mise en ligne.
const BIENTOT = new Set([
  "Inscription prioritaire aux tournois",
  "Alertes Discord avancées",
  "Accès aux formats premium",
  // Ajoutés le 28/09/2026 (audit M14) : ni personnalisation visuelle d'un
  // tournoi, ni canal de support n'existent encore.
  "Branding de tournoi",
  "Support prioritaire",
]);

const FILTRES: { pour: Profil | null; libelle: string; href: string }[] = [
  { pour: null, libelle: "Tout voir", href: "/tarifs" },
  { pour: "joueur", libelle: "Je joue", href: "/tarifs?pour=joueur" },
  { pour: "organiser", libelle: "J'organise", href: "/tarifs?pour=organiser" },
];

// Les paliers sont cumulatifs : « je joue » n'a pas besoin de la colonne
// Organisateur, « j'organise » n'a pas besoin de Vérifié/Elite.
const OFFRES_VISIBLES: Record<Profil, Offre[]> = {
  joueur: ["gratuit", "verifie", "elite"],
  organiser: ["gratuit", "organisateur"],
};

// Tailwind ne génère pas une classe construite dynamiquement (`lg:grid-cols-${n}`) :
// le nom complet doit apparaître tel quel dans le code source.
const GRILLE_CARTES: Record<number, string> = {
  2: "grid-cols-1 gap-5 md:grid-cols-2 lg:max-w-4xl",
  3: "grid-cols-1 gap-5 md:grid-cols-3",
  4: "grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4",
};

// « Bientôt » en gris (revue visuelle du 05/10/2026) : c'était une pastille
// verte, alors que MASTER réserve le vert à l'essentiel — une promesse pas
// encore tenue n'a pas à attirer l'œil plus qu'une fonction livrée.
function PastilleBientot() {
  return (
    <span className="ml-2 inline-block rounded-bouton border border-line-strong px-1.5 py-px align-[1px] font-texte text-[10px] font-medium tracking-[2px] text-muted uppercase">
      Bientôt
    </span>
  );
}

const TITRE_GROUPE: Record<Offre, string> = {
  gratuit: "Pour tous, gratuit",
  verifie: "Dès Vérifié",
  elite: "Dès Elite",
  organisateur: "Organisateur",
};

const PALIERS: Palier[] = [
  {
    nom: "Gratuit",
    prix: "0\u00a0€",
    accroche: "Le cœur du produit, pour toujours.",
    inclus: [
      "Classement Glicko-2 et paliers",
      "Niveau de fiabilité affiché sur chaque match",
      "Profil public partageable",
      "Tournois 1v1 quotidiens",
      "Recherche de coéquipier",
      "Bilan express : forces et axes de travail, tournois et classées",
    ],
    cta: { libelle: "Créer mon compte", href: "/inscription" },
  },
  {
    nom: "Vérifié",
    cle: "verifie",
    prix: "3–4\u00a0€",
    periode: "/mois",
    accroche: "Une identité qui se remarque.",
    inclus: [
      "Badge Vérifié sur le profil et le classement",
      "Qui a consulté mon profil",
      "Personnalisation du profil",
      "Inscription prioritaire aux tournois",
    ],
    cta: { libelle: "S'abonner" },
  },
  {
    nom: "Elite",
    cle: "elite",
    prix: "7–8\u00a0€",
    periode: "/mois",
    accroche: "Pour suivre sa progression de près.",
    inclus: [
      "Tout Vérifié",
      "Bilan complet : plan d'entraînement, progression, champions, builds",
      "Classées : niveau, hygiène de jeu, carte des morts, sang-froid",
      "Bilan de la semaine sur Discord",
      "Export CV premium (PDF, lien partageable)",
      "Revue de match écrite",
      "Alertes Discord avancées",
      "Accès aux formats premium",
    ],
    cta: { libelle: "S'abonner" },
  },
  {
    nom: "Organisateur",
    cle: "organisateur",
    prix: "10–15\u00a0€",
    periode: "/mois",
    accroche: "Pour héberger sans limite.",
    inclus: [
      "Capacité de tournoi étendue",
      "Branding de tournoi",
      "Formats premium à l'hébergement",
      "Support prioritaire",
    ],
    cta: { libelle: "S'abonner" },
  },
];

// Reprend mot pour mot les puces de PALIERS[].inclus, juste transposées en
// lignes — aucune fonctionnalité nouvelle, seulement un second format pour
// répondre à "qu'est-ce qui me manque précisément" (dossier concurrentiel,
// idée #2 du 14/09). Les paliers sont cumulatifs (ORDRE_OFFRE, déjà utilisé
// pour gater CV export / revue de match) : `depuis` suffit à cocher toutes
// les colonnes à partir de ce palier.
const MATRICE: { fonctionnalite: string; depuis: Offre }[] = [
  { fonctionnalite: "Classement Glicko-2 et paliers", depuis: "gratuit" },
  { fonctionnalite: "Niveau de fiabilité affiché sur chaque match", depuis: "gratuit" },
  { fonctionnalite: "Profil public partageable", depuis: "gratuit" },
  { fonctionnalite: "Tournois 1v1 quotidiens", depuis: "gratuit" },
  { fonctionnalite: "Recherche de coéquipier", depuis: "gratuit" },
  { fonctionnalite: "Bilan express : forces et axes de travail, tournois et classées", depuis: "gratuit" },
  { fonctionnalite: "Badge Vérifié sur le profil et le classement", depuis: "verifie" },
  { fonctionnalite: "Qui a consulté mon profil", depuis: "verifie" },
  { fonctionnalite: "Personnalisation du profil", depuis: "verifie" },
  { fonctionnalite: "Inscription prioritaire aux tournois", depuis: "verifie" },
  { fonctionnalite: "Bilan complet : plan d'entraînement, progression, champions, builds", depuis: "elite" },
  { fonctionnalite: "Classées : niveau, hygiène de jeu, carte des morts, sang-froid", depuis: "elite" },
  { fonctionnalite: "Bilan de la semaine sur Discord", depuis: "elite" },
  { fonctionnalite: "Export CV premium (PDF, lien partageable)", depuis: "elite" },
  { fonctionnalite: "Revue de match écrite", depuis: "elite" },
  { fonctionnalite: "Alertes Discord avancées", depuis: "elite" },
  { fonctionnalite: "Accès aux formats premium", depuis: "elite" },
  { fonctionnalite: "Capacité de tournoi étendue", depuis: "organisateur" },
  { fonctionnalite: "Branding de tournoi", depuis: "organisateur" },
  { fonctionnalite: "Formats premium à l'hébergement", depuis: "organisateur" },
  { fonctionnalite: "Support prioritaire", depuis: "organisateur" },
];

export default async function TarifsPage({ searchParams }: TarifsPageProps) {
  const { erreur, message, pour: pourBrut } = await searchParams;
  const pour: Profil | null = pourBrut === "joueur" || pourBrut === "organiser" ? pourBrut : null;

  const paliersVisibles = pour
    ? PALIERS.filter((p) => OFFRES_VISIBLES[pour].includes(p.cle ?? "gratuit"))
    : PALIERS;
  const lignesVisibles = pour === "joueur" ? MATRICE.filter((l) => l.depuis !== "organisateur") : MATRICE;

  // Un seul palier mis en avant, un seul bouton vert (MASTER §2 : le vert
  // est rare) : Elite pour un joueur, Organisateur pour qui organise.
  const enAvant: Offre = pour === "organiser" ? "organisateur" : "elite";
  const groupes = (Object.keys(TITRE_GROUPE) as Offre[])
    .map((offre) => ({ offre, lignes: lignesVisibles.filter((l) => l.depuis === offre) }))
    .filter((g) => g.lignes.length > 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-16 px-grille">
        <Apparition>
          <LibelleSection>Tarifs</LibelleSection>
          <h1 className="mt-4 max-w-5xl font-titre text-section font-black tracking-[1px] uppercase">
            Ton niveau reste gratuit. <span className="text-accent">Pour toujours.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-courant text-text-2">
            Le classement, les verdicts et le profil public ne seront jamais payants — c&apos;est la promesse du site. Les
            paliers ci-dessous ajoutent de l&apos;identité et du confort, jamais un péage sur la preuve.
          </p>
          {(erreur || message) && (
            <div className="mt-8 flex max-w-2xl flex-col gap-3">
              {erreur && <Alerte type="erreur">{erreur}</Alerte>}
              {message && <Alerte type="succes">{message}</Alerte>}
            </div>
          )}
        </Apparition>

        <Apparition delai={0.1}>
          <section aria-labelledby="tarifs-paliers" className="flex flex-col gap-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <LibelleSection as="h2" id="tarifs-paliers" numero="01">
                Les paliers
              </LibelleSection>
              <nav aria-label="Filtrer les paliers" className="flex flex-wrap gap-2">
                {FILTRES.map((f) => {
                  const actif = f.pour === pour;
                  return (
                    <Link
                      key={f.libelle}
                      href={f.href}
                      aria-current={actif ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center rounded-bouton border px-4 font-texte text-sm font-semibold tracking-[2px] uppercase transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                        actif ? "border-text text-text" : "border-line-strong text-muted hover:border-[rgba(245,245,244,0.25)] hover:text-text"
                      }`}
                    >
                      {f.libelle}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className={`grid ${GRILLE_CARTES[paliersVisibles.length]}`}>
              {paliersVisibles.map((p) => {
                const offre: Offre = p.cle ?? "gratuit";
                const misEnAvant = offre === enAvant;
                return (
                  <article
                    key={p.nom}
                    aria-labelledby={`palier-${offre}`}
                    className="panneau relative flex flex-col overflow-hidden p-6 sm:p-7"
                  >
                    {misEnAvant && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
                    <div className="flex min-h-6 items-center justify-between gap-3">
                      <h3 id={`palier-${offre}`} className="font-texte text-libelle font-semibold text-text uppercase">
                        {p.nom}
                      </h3>
                      {misEnAvant && (
                        <span className="font-texte text-mini font-medium text-accent uppercase">Recommandé</span>
                      )}
                    </div>
                    <p className="mt-5 flex items-baseline gap-2">
                      <span className="font-titre text-[3.25rem] leading-none font-black tabular-nums">{p.prix}</span>
                      {p.periode && <span className="text-sm text-muted">{p.periode}</span>}
                    </p>
                    <p className="mt-3 text-sm text-text-2">{p.accroche}</p>

                    <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-line pt-6 text-sm text-text">
                      {p.inclus.map((i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Icone nom="coche" taille={15} className="mt-0.5 text-muted" />
                          <span>
                            {i}
                            {BIENTOT.has(i) && <PastilleBientot />}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {p.cta.href ? (
                      <BoutonLien href={p.cta.href} variante={misEnAvant ? "principal" : "contour"} className="mt-8 w-full">
                        {p.cta.libelle}
                      </BoutonLien>
                    ) : (
                      <form action={demarrerAbonnement} className="mt-8">
                        <input type="hidden" name="offre" value={p.cle} />
                        <BoutonEnvoi
                          variante={misEnAvant ? "principal" : "contour"}
                          libelleEnCours="Redirection…"
                          className="w-full"
                        >
                          {p.cta.libelle}
                        </BoutonEnvoi>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="max-w-2xl text-sm text-muted">
              Vérifié, Elite et Organisateur sont en cours de lancement — ces prix sont indicatifs et pourront évoluer.
            </p>
          </section>
        </Apparition>

        <Apparition delai={0.12}>
          <section aria-labelledby="tarifs-comparer" className="flex flex-col gap-8">
            <LibelleSection as="h2" id="tarifs-comparer" numero="02">
              Comparer les paliers
            </LibelleSection>
            <Tableau legende="Fonctionnalités incluses dans chaque palier">
              <thead>
                <tr>
                  <th scope="col">Fonctionnalité</th>
                  {paliersVisibles.map((p) => (
                    <th
                      key={p.nom}
                      scope="col"
                      className={`w-28 text-center! ${(p.cle ?? "gratuit") === enAvant ? "text-text!" : ""}`}
                    >
                      {p.nom}
                    </th>
                  ))}
                </tr>
              </thead>
              {groupes.map((g) => (
                <tbody key={g.offre}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={paliersVisibles.length + 1}
                      className="pt-8! pb-3! font-texte text-mini font-medium text-faint uppercase"
                    >
                      {TITRE_GROUPE[g.offre]}
                    </th>
                  </tr>
                  {g.lignes.map((ligne) => (
                    <tr key={ligne.fonctionnalite}>
                      <th
                        scope="row"
                        className="border-[rgba(245,245,244,0.06)]! py-3.5! text-sm! font-normal! tracking-normal! text-text! normal-case! whitespace-normal!"
                      >
                        {ligne.fonctionnalite}
                      </th>
                      {paliersVisibles.map((p) => {
                        const inclus = ORDRE_OFFRE[p.cle ?? "gratuit"] >= ORDRE_OFFRE[ligne.depuis];
                        return (
                          <td key={p.nom} className="py-3.5! text-center">
                            {inclus && BIENTOT.has(ligne.fonctionnalite) ? (
                              <span className="font-texte text-[10px] font-medium tracking-[2px] text-muted uppercase">
                                Bientôt
                              </span>
                            ) : inclus ? (
                              <Icone nom="coche" taille={16} libelle="Inclus" className="mx-auto text-text" />
                            ) : (
                              <span className="text-faint">
                                <span aria-hidden="true">—</span>
                                <span className="sr-only">Non inclus</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </Tableau>
            <p className="text-sm text-muted">
              « Bientôt » : en cours de développement, inclus dans le palier dès leur mise en ligne.
            </p>
          </section>
        </Apparition>

        <p className="text-sm text-muted">
          Une question sur les tarifs à venir ?{" "}
          <Link href="/faq" className="text-text underline underline-offset-3 hover:text-accent">
            Voir la FAQ
          </Link>{" "}
          ou{" "}
          <Link href="/comment-ca-marche" className="text-text underline underline-offset-3 hover:text-accent">
            comment ça marche
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
