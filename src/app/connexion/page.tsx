import Link from "next/link";
import type { Metadata } from "next";
import { seConnecter, seConnecterAvecDiscord } from "@/lib/auth-actions";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Connexion — Najarena",
  description: "Connecte-toi à ton compte Najarena.",
  robots: { index: false, follow: false },
};

interface ConnexionPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function ConnexionPage({ searchParams }: ConnexionPageProps) {
  const { erreur, message } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <Apparition className="relative mx-auto w-full max-w-md px-6">
      <h1 className="font-titre uppercase text-section font-black tracking-[1px] text-text">
        Se connecter
      </h1>
      <p className="mt-1 text-sm text-muted">Retrouve ton classement vérifié.</p>

      {message && (
        <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
      )}

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}

      <form action={seConnecter} className="mt-6 flex flex-col gap-4">
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
            autoComplete="current-password"
            className="rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <Bouton libelleEnCours="Connexion…" className="mt-2">
          Se connecter
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
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-text underline underline-offset-3">
          S&apos;inscrire
        </Link>
      </p>
      </Apparition>
    </main>
  );
}
