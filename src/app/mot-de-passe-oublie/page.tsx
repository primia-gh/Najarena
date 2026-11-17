import Link from "next/link";
import type { Metadata } from "next";
import { demanderReinitialisation } from "@/lib/auth-actions";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import CadreCompte, { ChampCompte } from "@/components/compte/CadreCompte";

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
    <CadreCompte
      libelle="Compte joueur"
      titre="Mot de passe oublié"
      intro={<p>Indique l&apos;adresse de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.</p>}
      alerte={
        erreur || message ? (
          <div className="flex flex-col gap-3">
            {message && <Alerte type="succes">{message}</Alerte>}
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          </div>
        ) : undefined
      }
      pied={
        <Link href="/connexion" className="font-semibold text-text underline underline-offset-3 hover:text-accent">
          Retour à la connexion
        </Link>
      }
    >
      <form action={demanderReinitialisation} className="flex flex-col gap-4">
        <ChampCompte libelle="E-mail">
          <input name="email" type="email" required autoComplete="email" className={classeChamp()} />
        </ChampCompte>
        <BoutonEnvoi libelleEnCours="Envoi…" className="mt-2 w-full">
          Recevoir le lien
        </BoutonEnvoi>
      </form>
    </CadreCompte>
  );
}
