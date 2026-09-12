import Link from "next/link";
import type { Metadata } from "next";
import { seConnecter, seConnecterAvecDiscord } from "@/lib/auth-actions";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-encre">
        Se connecter
      </h1>

      {message && (
        <p className="mt-6 rounded-[3px] border border-atteste/30 bg-atteste/10 p-3 text-sm text-atteste">
          {message}
        </p>
      )}

      {erreur && (
        <p className="mt-6 rounded-[3px] border border-sceau/30 bg-sceau/10 p-3 text-sm text-sceau">
          {erreur}
        </p>
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

        <button
          type="submit"
          className="mt-2 rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
        >
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
        <button
          type="submit"
          className="w-full rounded-[3px] border border-trait bg-carte px-4 py-2 text-sm font-semibold text-encre transition hover:border-encre"
        >
          Continuer avec Discord
        </button>
      </form>

      <p className="mt-6 text-sm text-ardoise">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-encre underline underline-offset-3">
          S&apos;inscrire
        </Link>
      </p>
    </main>
  );
}
