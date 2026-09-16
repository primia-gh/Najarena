import Link from "next/link";
import type { Metadata } from "next";
import SectionTitre from "@/components/ui/SectionTitre";
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
  prix: string;
  periode?: string;
  accroche: string;
  inclus: string[];
  cta: { libelle: string; href?: string };
  disponible: boolean;
  accent: "sceau" | "laiton" | "none";
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
    disponible: true,
    accent: "none",
  },
  {
    nom: "Vérifié",
    prix: "3-4€",
    periode: "/mois",
    accroche: "Une identité qui se remarque.",
    inclus: [
      "Badge Vérifié sur le profil et le classement",
      "Qui a consulté mon profil",
      "Personnalisation du profil",
      "Inscription prioritaire aux tournois",
    ],
    cta: { libelle: "Bientôt disponible" },
    disponible: false,
    accent: "laiton",
  },
  {
    nom: "Elite",
    prix: "7-8€",
    periode: "/mois",
    accroche: "Pour suivre sa progression de près.",
    inclus: [
      "Tout Vérifié",
      "Export CV premium (PDF, lien partageable)",
      "Alertes Discord avancées",
      "Accès aux formats premium",
    ],
    cta: { libelle: "Bientôt disponible" },
    disponible: false,
    accent: "sceau",
  },
  {
    nom: "Organisateur",
    prix: "10-15€",
    periode: "/mois",
    accroche: "Pour héberger sans limite.",
    inclus: [
      "Capacité de tournoi étendue",
      "Branding de tournoi",
      "Formats premium à l'hébergement",
      "Support prioritaire",
    ],
    cta: { libelle: "Bientôt disponible" },
    disponible: false,
    accent: "none",
  },
];

const ACCENT_BORDURE: Record<Palier["accent"], string> = {
  sceau: "border-t-sceau",
  laiton: "border-t-laiton",
  none: "border-t-trait",
};

export default function TarifsPage() {
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

                  {p.disponible && p.cta.href ? (
                    <Link
                      href={p.cta.href}
                      className="mt-5 rounded-[3px] bg-sceau px-4 py-2 text-center text-sm font-semibold text-papier transition hover:brightness-110"
                    >
                      {p.cta.libelle}
                    </Link>
                  ) : (
                    <span className="mt-5 rounded-[3px] border border-trait px-4 py-2 text-center font-mono text-[0.66rem] tracking-[0.08em] text-ardoise uppercase">
                      {p.cta.libelle}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-lg text-sm text-ardoise">
              Vérifié, Elite et Organisateur sont en préparation — pas encore disponibles à
              l&apos;achat. Ces prix sont indicatifs et pourront évoluer avant leur lancement.
            </p>
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
