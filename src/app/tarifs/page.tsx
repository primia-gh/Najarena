import Link from "next/link";
import type { Metadata } from "next";
import SectionTitre from "@/components/ui/SectionTitre";
import Bouton from "@/components/ui/Bouton";
import { classeCarte } from "@/lib/ui";
import { demarrerAbonnement } from "@/lib/stripe-actions";
import { ORDRE_OFFRE, type Offre } from "@/lib/offres";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

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
  accent: "sceau" | "laiton" | "none";
}

interface TarifsPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

const PALIERS: Palier[] = [
  {
    nom: "Gratuit",
    prix: "0€",
    accroche: "Le cœur du produit, pour toujours.",
    inclus: [
      "Classement Glicko-2 et paliers",
      "Verdicts vérifiés sur chaque match",
      "Profil public partageable",
      "Tournois 1v1 et 5v5 quotidiens",
      "Recherche de coéquipier",
    ],
    cta: { libelle: "Créer mon compte", href: "/inscription" },
    accent: "none",
  },
  {
    nom: "Vérifié",
    cle: "verifie",
    prix: "3-4€",
    periode: "/mois",
    accroche: "Une identité qui se remarque.",
    inclus: [
      "Badge Vérifié sur le profil et le classement",
      "Qui a consulté mon profil",
      "Personnalisation du profil",
      "Inscription prioritaire aux tournois",
    ],
    cta: { libelle: "S'abonner" },
    accent: "laiton",
  },
  {
    nom: "Elite",
    cle: "elite",
    prix: "7-8€",
    periode: "/mois",
    accroche: "Pour suivre sa progression de près.",
    inclus: [
      "Tout Vérifié",
      "Export CV premium (PDF, lien partageable)",
      "Revue de match écrite",
      "Alertes Discord avancées",
      "Accès aux formats premium",
    ],
    cta: { libelle: "S'abonner" },
    accent: "sceau",
  },
  {
    nom: "Organisateur",
    cle: "organisateur",
    prix: "10-15€",
    periode: "/mois",
    accroche: "Pour héberger sans limite.",
    inclus: [
      "Capacité de tournoi étendue",
      "Branding de tournoi",
      "Formats premium à l'hébergement",
      "Support prioritaire",
    ],
    cta: { libelle: "S'abonner" },
    accent: "none",
  },
];

const ACCENT_BORDURE: Record<Palier["accent"], string> = {
  sceau: "border-t-sceau",
  laiton: "border-t-laiton",
  none: "border-t-trait",
};

// Reprend mot pour mot les puces de PALIERS[].inclus, juste transposées en
// lignes — aucune fonctionnalité nouvelle, seulement un second format pour
// répondre à "qu'est-ce qui me manque précisément" (dossier concurrentiel,
// idée #2 du 14/09). Les paliers sont cumulatifs (ORDRE_OFFRE, déjà utilisé
// pour gater CV export / revue de match) : `depuis` suffit à cocher toutes
// les colonnes à partir de ce palier.
const MATRICE: { fonctionnalite: string; depuis: Offre }[] = [
  { fonctionnalite: "Classement Glicko-2 et paliers", depuis: "gratuit" },
  { fonctionnalite: "Verdicts vérifiés sur chaque match", depuis: "gratuit" },
  { fonctionnalite: "Profil public partageable", depuis: "gratuit" },
  { fonctionnalite: "Tournois 1v1 et 5v5 quotidiens", depuis: "gratuit" },
  { fonctionnalite: "Recherche de coéquipier", depuis: "gratuit" },
  { fonctionnalite: "Badge Vérifié sur le profil et le classement", depuis: "verifie" },
  { fonctionnalite: "Qui a consulté mon profil", depuis: "verifie" },
  { fonctionnalite: "Personnalisation du profil", depuis: "verifie" },
  { fonctionnalite: "Inscription prioritaire aux tournois", depuis: "verifie" },
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
  const { erreur, message } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-5xl px-6">
        <Reveal>
          <span className="block font-mono text-[0.66rem] tracking-[0.22em] text-ardoise uppercase">
            Tarifs
          </span>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
            Ton niveau reste gratuit. Pour toujours.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-ardoise">
            Le classement, les verdicts et le profil public ne seront jamais payants — c&apos;est la
            promesse du site. Les paliers ci-dessous ajoutent de l&apos;identité et du confort,
            jamais un péage sur la preuve.
          </p>
        </Reveal>

        {erreur && (
          <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
        )}
        {message && (
          <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-atteste"}>{message}</p>
        )}

        <Reveal delai={0.1}>
          <section className="mt-12">
            <SectionTitre>Les paliers</SectionTitre>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PALIERS.map((p) => (
                <div
                  key={p.nom}
                  className={`flex flex-col rounded-[3px] border border-trait border-t-[3px] bg-carte p-5 ${ACCENT_BORDURE[p.accent]}`}
                >
                  <span className="font-mono text-[0.64rem] tracking-[0.1em] text-ardoise uppercase">
                    {p.nom}
                  </span>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="font-mono text-2xl font-bold text-encre">{p.prix}</span>
                    {p.periode && <span className="font-mono text-xs text-ardoise">{p.periode}</span>}
                  </div>
                  <p className="mt-1.5 text-sm text-ardoise">{p.accroche}</p>

                  <ul className="mt-4 flex flex-1 flex-col gap-2 text-[0.82rem] text-encre">
                    {p.inclus.map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ardoise" aria-hidden="true" />
                        {i}
                      </li>
                    ))}
                  </ul>

                  {p.cta.href ? (
                    <Link
                      href={p.cta.href}
                      className="mt-5 rounded-[3px] bg-sceau px-4 py-2 text-center text-sm font-semibold text-papier transition hover:brightness-110"
                    >
                      {p.cta.libelle}
                    </Link>
                  ) : (
                    <form action={demarrerAbonnement} className="mt-5">
                      <input type="hidden" name="offre" value={p.cle} />
                      <Bouton libelleEnCours="Redirection…" className="w-full">
                        {p.cta.libelle}
                      </Bouton>
                    </form>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-lg text-sm text-ardoise">
              Vérifié, Elite et Organisateur sont en cours de lancement — ces prix sont indicatifs
              et pourront évoluer.
            </p>
          </section>
        </Reveal>

        <Reveal delai={0.12}>
          <section className="mt-12">
            <SectionTitre>Comparer les paliers</SectionTitre>
            <div className="mt-4 overflow-x-auto rounded-[3px] border border-trait bg-carte shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-trait">
                    <th className="px-4 py-2 font-mono text-[0.6rem] tracking-[0.12em] text-ardoise uppercase">
                      Fonctionnalité
                    </th>
                    {PALIERS.map((p) => (
                      <th
                        key={p.nom}
                        className="px-4 py-2 text-center font-mono text-[0.6rem] tracking-[0.12em] text-ardoise uppercase"
                      >
                        {p.nom}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRICE.map((ligne) => (
                    <tr key={ligne.fonctionnalite} className="border-b border-trait last:border-b-0">
                      <td className="px-4 py-2 text-encre">{ligne.fonctionnalite}</td>
                      {PALIERS.map((p) => {
                        const cle = (p.cle ?? "gratuit") as Offre;
                        const inclus = ORDRE_OFFRE[cle] >= ORDRE_OFFRE[ligne.depuis];
                        return (
                          <td key={p.nom} className="px-4 py-2 text-center">
                            {inclus ? (
                              <span className="text-atteste">✓</span>
                            ) : (
                              <span className="text-ardoise/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </Reveal>

        <Reveal delai={0.15}>
          <p className="mt-12 text-sm text-ardoise">
            Une question sur les tarifs à venir ?{" "}
            <Link href="/comment-ca-marche" className="text-encre underline underline-offset-3">
              Voir comment ça marche
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </main>
  );
}
