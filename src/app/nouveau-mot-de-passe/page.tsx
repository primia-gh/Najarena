import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { changerMotDePasse } from "@/lib/auth-actions";
import { createClient } from "@/lib/supabase/server";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import CadreCompte, { ChampCompte } from "@/components/compte/CadreCompte";

export const metadata: Metadata = {
  title: "Nouveau mot de passe — Najarena",
  robots: { index: false, follow: false },
};

interface NouveauMotDePassePageProps {
  searchParams: Promise<{ erreur?: string }>;
}

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
    <CadreCompte
      libelle="Compte joueur"
      titre="Nouveau mot de passe"
      intro={<p>8 caractères au moins.</p>}
      alerte={erreur ? <Alerte type="erreur">{erreur}</Alerte> : undefined}
    >
      <form action={changerMotDePasse} className="flex flex-col gap-4">
        <ChampCompte libelle="Nouveau mot de passe">
          <input name="mot_de_passe" type="password" required minLength={8} autoComplete="new-password" className={classeChamp()} />
        </ChampCompte>
        <ChampCompte libelle="Confirmation">
          <input name="confirmation" type="password" required minLength={8} autoComplete="new-password" className={classeChamp()} />
        </ChampCompte>
        <BoutonEnvoi libelleEnCours="Enregistrement…" className="mt-2 w-full">
          Enregistrer
        </BoutonEnvoi>
      </form>
    </CadreCompte>
  );
}
