import Link from "next/link";
import type { Metadata } from "next";
import { demanderReinitialisation } from "@/lib/auth-actions";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Mot de passe oublié — Najarena",
  description: "Recevoir un lien pour choisir un nouveau mot de passe.",
  robots: { index: false, follow: false },
};

interface MotDePasseOubliePageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function MotDePasseOubliePage({ searchParams }: MotDePasseOubliePageProps) {
  const { erreur, message } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <Apparition className="relative mx-auto w-full max-w-md px-6">
        <h1 className="font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
          Mot de passe oublié
        </h1>
        <p className="mt-1 text-sm text-muted">
          Indique l&apos;adresse de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.
        </p>

        {message && (
          <p role="status" className={"mt-6 " + classeCarte("atteste") + " text-sm text-accent"}>
            {message}
          </p>
        )}
        {erreur && (
          <p role="alert" className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>
            {erreur}
          </p>
        )}

        <form action={demanderReinitialisation} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">E-mail</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          <Bouton libelleEnCours="Envoi…" className="mt-2">
            Recevoir le lien
          </Bouton>
        </form>

        <p className="mt-6 text-sm text-muted">
          <Link href="/connexion" className="text-text underline underline-offset-3">
            Retour à la connexion
          </Link>
        </p>
      </Apparition>
    </main>
  );
}
