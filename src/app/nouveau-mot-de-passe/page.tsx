import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { changerMotDePasse } from "@/lib/auth-actions";
import { createClient } from "@/lib/supabase/server";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Nouveau mot de passe — Najarena",
  robots: { index: false, follow: false },
};

interface NouveauMotDePassePageProps {
  searchParams: Promise<{ erreur?: string }>;
}

const CHAMP =
  "min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Atteinte par le lien de l'e-mail « mot de passe oublié » (session ouverte
// par /auth/callback), ou par un joueur connecté qui veut changer le sien.
export default async function NouveauMotDePassePage({ searchParams }: NouveauMotDePassePageProps) {
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/mot-de-passe-oublie?erreur=${encodeURIComponent("Lien expiré ou déjà utilisé : demande un nouvel e-mail.")}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <Apparition className="relative mx-auto w-full max-w-md px-6">
        <h1 className="font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
          Nouveau mot de passe
        </h1>
        <p className="mt-1 text-sm text-muted">8 caractères au moins.</p>

        {erreur && (
          <p role="alert" className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>
            {erreur}
          </p>
        )}

        <form action={changerMotDePasse} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">Nouveau mot de passe</span>
            <input name="mot_de_passe" type="password" required minLength={8} autoComplete="new-password" className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">Confirmation</span>
            <input name="confirmation" type="password" required minLength={8} autoComplete="new-password" className={CHAMP} />
          </label>
          <Bouton libelleEnCours="Enregistrement…" className="mt-2">
            Enregistrer
          </Bouton>
        </form>
      </Apparition>
    </main>
  );
}
