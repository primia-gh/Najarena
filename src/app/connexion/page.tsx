import Link from "next/link";
import type { Metadata } from "next";
import { seConnecter, seConnecterAvecDiscord } from "@/lib/auth-actions";
import { classeCarte, classeBoutonPrimaire, classeBoutonSecondaire } from "@/lib/ui";
import FondArene from "@/components/accueil/FondArene";
import Reveal from "@/components/accueil/Reveal";

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
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden py-16">
      <FondArene />
      <Reveal className="relative mx-auto w-full max-w-md px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-encre">
        Se connecter
      </h1>
      <p className="mt-1 text-sm text-ardoise">Retrouve ton classement vérifié.</p>

      {message && (
        <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-atteste"}>{message}</p>
      )}

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
      )}

      <form action={seConnecter} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            E-mail
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Mot de passe
          </span>
          <input
            name="mot_de_passe"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
        </label>

        <button type="submit" className={"mt-2 " + classeBoutonPrimaire()}>
          Se connecter
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-trait" />
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">ou</span>
        <span className="h-px flex-1 bg-trait" />
      </div>

      <form action={seConnecterAvecDiscord} className="mt-6 flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm text-ardoise">
          <input name="age_confirme" type="checkbox" required className="mt-0.5 accent-sceau" />
          <span>
            J&apos;ai au moins 15 ans, ou j&apos;ai l&apos;autorisation de mon
            représentant légal (voir les{" "}
            <Link href="/cgu" className="text-encre underline underline-offset-3">
              CGU
            </Link>
            ).
          </span>
        </label>
        <button type="submit" className={"w-full " + classeBoutonSecondaire()}>
          Continuer avec Discord
        </button>
      </form>

      <p className="mt-6 text-sm text-ardoise">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-encre underline underline-offset-3">
          S&apos;inscrire
        </Link>
      </p>
      </Reveal>
    </main>
  );
}
