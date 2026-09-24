import Link from "next/link";
import type { Metadata } from "next";
import SectionTitre from "@/components/ui/SectionTitre";
import Bouton from "@/components/ui/Bouton";
import { classeCarte } from "@/lib/ui";
import { demarrerAbonnement } from "@/lib/stripe-actions";
import { ORDRE_OFFRE, type Offre } from "@/lib/offres";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

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
  2: "grid-cols-1 gap-4 sm:grid-cols-2",
  3: "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
};

function PastilleBientot() {
  return (
    <span className="ml-2 rounded-full border border-accent/30 bg-accent/12 px-1.5 py-0.5 font-texte tabular-nums text-mini tracking-[0.08em] text-accent uppercase">
      Bientôt
    </span>
  );
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
      "Tournois 1v1 quotidiens",
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
  sceau: "border-t-accent",
  laiton: "border-t-accent",
  none: "border-t-line",
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
  { fonctionnalite: "Tournois 1v1 quotidiens", depuis: "gratuit" },
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
  const { erreur, message, pour: pourBrut } = await searchParams;
  const pour: Profil | null = pourBrut === "joueur" || pourBrut === "organiser" ? pourBrut : null;

  const paliersVisibles = pour
    ? PALIERS.filter((p) => OFFRES_VISIBLES[pour].includes(p.cle ?? "gratuit"))
    : PALIERS;
  const lignesVisibles = pour === "joueur" ? MATRICE.filter((l) => l.depuis !== "organisateur") : MATRICE;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />      <div className="relative mx-auto max-w-contenu px-gouttiere">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">
            Tarifs
          </span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Ton niveau reste gratuit. Pour toujours.
          </h1>
          <p className="mt-3 max-w-lg text-sm text-muted">
            Le classement, les verdicts et le profil public ne seront jamais payants — c&apos;est la
            promesse du site. Les paliers ci-dessous ajoutent de l&apos;identité et du confort,
            jamais un péage sur la preuve.
          </p>
        </Apparition>

        {erreur && (
          <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
        )}
        {message && (
          <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
        )}

        <Apparition delai={0.1}>
          <section className="mt-12">
            <SectionTitre>Les paliers</SectionTitre>
            <nav aria-label="Filtrer les paliers" className="mt-4 flex flex-wrap gap-2">
              {FILTRES.map((f) => {
                const actif = f.pour === pour;
                return (
                  <Link
                    key={f.libelle}
                    href={f.href}
                    aria-current={actif ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-bouton border px-3 py-1.5 font-texte tabular-nums text-mini tracking-[0.1em] uppercase transition ${
                      actif
                        ? "border-text text-text"
                        : "border-line text-muted hover:border-muted hover:text-text"
                    }`}
                  >
                    {f.libelle}
                  </Link>
                );
              })}
            </nav>
            <div className={`mt-4 grid ${GRILLE_CARTES[paliersVisibles.length]}`}>
              {paliersVisibles.map((p) => (
                <div
                  key={p.nom}
                  className={`flex flex-col rounded-[3px] border border-line border-t-[3px] bg-surface p-5 ${ACCENT_BORDURE[p.accent]}`}
                >
                  <span className="font-texte tabular-nums text-mini tracking-[0.1em] text-muted uppercase">
                    {p.nom}
                  </span>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="font-texte tabular-nums text-2xl font-bold text-text">{p.prix}</span>
                    {p.periode && <span className="font-texte tabular-nums text-xs text-muted">{p.periode}</span>}
                  </div>
                  <p className="mt-1.5 text-sm text-muted">{p.accroche}</p>

                  <ul className="mt-4 flex flex-1 flex-col gap-2 text-[0.82rem] text-text">
                    {p.inclus.map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                        <span>
                          {i}
                          {BIENTOT.has(i) && <PastilleBientot />}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {p.cta.href ? (
                    <Link
                      href={p.cta.href}
                      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-bouton bg-accent px-4 py-2 text-center text-sm font-semibold text-bg transition hover:brightness-110"
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
            <p className="mt-6 max-w-lg text-sm text-muted">
              Vérifié, Elite et Organisateur sont en cours de lancement — ces prix sont indicatifs
              et pourront évoluer.
            </p>
          </section>
        </Apparition>

        <Apparition delai={0.12}>
          <section className="mt-12">
            <SectionTitre>Comparer les paliers</SectionTitre>
            <div className="mt-4 overflow-x-auto rounded-[3px] border border-line bg-surface shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                      Fonctionnalité
                    </th>
                    {paliersVisibles.map((p) => (
                      <th
                        key={p.nom}
                        className="px-4 py-2 text-center font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase"
                      >
                        {p.nom}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignesVisibles.map((ligne) => (
                    <tr key={ligne.fonctionnalite} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2 text-text">{ligne.fonctionnalite}</td>
                      {paliersVisibles.map((p) => {
                        const cle = (p.cle ?? "gratuit") as Offre;
                        const inclus = ORDRE_OFFRE[cle] >= ORDRE_OFFRE[ligne.depuis];
                        return (
                          <td key={p.nom} className="px-4 py-2 text-center">
                            {inclus && BIENTOT.has(ligne.fonctionnalite) ? (
                              <span className="font-texte tabular-nums text-mini tracking-[0.08em] text-accent uppercase">
                                Bientôt
                              </span>
                            ) : inclus ? (
                              <span className="text-accent">✓</span>
                            ) : (
                              <span className="text-muted/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.78rem] text-muted">
              « Bientôt » : en cours de développement, inclus dans le palier dès leur mise en ligne.
            </p>
          </section>
        </Apparition>

        <Apparition delai={0.15}>
          <p className="mt-12 text-sm text-muted">
            Une question sur les tarifs à venir ?{" "}
            <Link href="/faq" className="text-text underline underline-offset-3">
              Voir la FAQ
            </Link>{" "}
            ou{" "}
            <Link href="/comment-ca-marche" className="text-text underline underline-offset-3">
              comment ça marche
            </Link>
            .
          </p>
        </Apparition>
      </div>
    </main>
  );
}
