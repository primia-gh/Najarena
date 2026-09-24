import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { creerEquipe } from "@/lib/equipe-actions";
import { TAILLE_MAX_EQUIPE } from "@/lib/equipe";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

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
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-md px-gouttiere">
      <Apparition>
      <Link
        href="/moi"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Créer une équipe
      </h1>
      <p className="mt-2 text-sm text-muted">
        League of Legends · pour jouer en 5v5 (les tournois 5v5 ouvriront bientôt). Tu en es
        automatiquement le capitaine, avec jusqu&apos;à {TAILLE_MAX_EQUIPE - 1} coéquipiers à
        inviter ensuite.
      </p>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}

      <form action={creerEquipe} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Nom de l&apos;équipe
          </span>
          <input
            name="nom"
            type="text"
            required
            minLength={3}
            maxLength={40}
            placeholder="Ex. Les Barons du Mardi"
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Tag (2 à 5 caractères)
          </span>
          <input
            name="tag"
            type="text"
            required
            minLength={2}
            maxLength={5}
            placeholder="Ex. BDM"
            className="rounded-[3px] border border-line bg-surface px-3 py-2 text-sm uppercase text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <Bouton libelleEnCours="Création…" className="mt-2">
          Créer l&apos;équipe
        </Bouton>
      </form>
      </Apparition>
      </div>
    </main>
  );
}
