import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { creerEquipe } from "@/lib/equipe-actions";

export const metadata: Metadata = {
  title: "Créer une équipe — Najarena",
  robots: { index: false, follow: false },
};

interface EquipeNouvellePageProps {
  searchParams: Promise<{ erreur?: string }>;
}

export default async function EquipeNouvellePage({ searchParams }: EquipeNouvellePageProps) {
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Link
        href="/moi"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-encre">
        Créer une équipe
      </h1>
      <p className="mt-2 text-sm text-ardoise">
        League of Legends · pour jouer en 5v5. Tu en es automatiquement le
        capitaine.
      </p>

      {erreur && (
        <p className="mt-6 rounded-[3px] border border-sceau/30 bg-sceau/10 p-3 text-sm text-sceau">
          {erreur}
        </p>
      )}

      <form action={creerEquipe} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Nom de l&apos;équipe
          </span>
          <input
            name="nom"
            type="text"
            required
            minLength={3}
            maxLength={40}
            placeholder="Ex. Les Barons du Mardi"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Tag (2 à 5 caractères)
          </span>
          <input
            name="tag"
            type="text"
            required
            minLength={2}
            maxLength={5}
            placeholder="Ex. BDM"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm uppercase text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
        >
          Créer l&apos;équipe
        </button>
      </form>
    </main>
  );
}
