import Link from "next/link";
import type { Metadata } from "next";
import { sInscrire } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Inscription — Najarena",
  description:
    "Crée ton compte Najarena pour t'inscrire aux tournois League of Legends et construire ton profil vérifié.",
};

interface InscriptionPageProps {
  searchParams: Promise<{ erreur?: string }>;
}

export default async function InscriptionPage({ searchParams }: InscriptionPageProps) {
  const { erreur } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-encre">
        Créer un compte
      </h1>
      <p className="mt-2 text-sm text-ardoise">
        Le Riot ID se lie ensuite, depuis ton profil.
      </p>

      {erreur && (
        <p className="mt-6 rounded-[3px] border border-sceau/30 bg-sceau/10 p-3 text-sm text-sceau">
          {erreur}
        </p>
      )}

      <form action={sInscrire} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Pseudo
          </span>
          <input
            name="pseudo"
            type="text"
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            E-mail
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre"
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
            minLength={6}
            autoComplete="new-password"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
        >
          Créer mon compte
        </button>
      </form>

      <p className="mt-6 text-sm text-ardoise">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-encre underline underline-offset-3">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
