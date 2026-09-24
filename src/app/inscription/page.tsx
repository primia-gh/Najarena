import Link from "next/link";
import type { Metadata } from "next";
import { sInscrire, seConnecterAvecDiscord } from "@/lib/auth-actions";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Inscription — Najarena",
  description:
    "Crée ton compte Najarena pour t'inscrire aux tournois League of Legends et construire ton profil vérifié.",
  robots: { index: false, follow: false },
};

interface InscriptionPageProps {
  searchParams: Promise<{ erreur?: string }>;
}

export default async function InscriptionPage({ searchParams }: InscriptionPageProps) {
  const { erreur } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <Apparition className="relative mx-auto w-full max-w-md px-6">
      <h1 className="font-titre uppercase text-section font-black tracking-[1px] text-text">
        Créer un compte
      </h1>
      <p className="mt-1 text-sm text-muted">Ton niveau, vérifié — dès ton premier tournoi.</p>
      <p className="mt-2 text-sm text-muted">
        Le Riot ID se lie ensuite, depuis ton profil.
      </p>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}

      <form action={sInscrire} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Pseudo
          </span>
          <input
            name="pseudo"
            type="text"
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            className="rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            E-mail
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Mot de passe
          </span>
          <input
            name="mot_de_passe"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex items-start gap-2 text-sm text-muted">
          <input
            name="age_confirme"
            type="checkbox"
            required
            className="mt-0.5 accent-accent"
          />
          <span>
            J&apos;ai au moins 15 ans, ou j&apos;ai l&apos;autorisation de mon
            représentant légal (voir les{" "}
            <Link href="/cgu" className="text-text underline underline-offset-3">
              CGU
            </Link>
            ).
          </span>
        </label>

        <Bouton libelleEnCours="Création…" className="mt-2">
          Créer mon compte
        </Bouton>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-texte text-mini font-medium text-muted uppercase">ou</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={seConnecterAvecDiscord} className="mt-6 flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm text-muted">
          <input name="age_confirme" type="checkbox" required className="mt-0.5 accent-accent" />
          <span>
            J&apos;ai au moins 15 ans, ou j&apos;ai l&apos;autorisation de mon
            représentant légal (voir les{" "}
            <Link href="/cgu" className="text-text underline underline-offset-3">
              CGU
            </Link>
            ).
          </span>
        </label>
        <Bouton variante="secondaire" libelleEnCours="Redirection…" className="w-full">
          Continuer avec Discord
        </Bouton>
      </form>

      <p className="mt-6 text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-text underline underline-offset-3">
          Se connecter
        </Link>
      </p>
      </Apparition>
    </main>
  );
}
