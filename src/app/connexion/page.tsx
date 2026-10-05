import Link from "next/link";
import type { Metadata } from "next";
import { destinationInterne } from "@/lib/redirection";
import { seConnecter, seConnecterAvecDiscord } from "@/lib/auth-actions";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import CadreCompte, { ChampCompte, SeparateurOu } from "@/components/compte/CadreCompte";
import ConsentementCompte from "@/components/compte/ConsentementCompte";

export const metadata: Metadata = {
  title: "Connexion — Najarena",
  description: "Connecte-toi à ton compte Najarena.",
  robots: { index: false, follow: false },
};

interface ConnexionPageProps {
  searchParams: Promise<{ erreur?: string; message?: string; suite?: string }>;
}

export default async function ConnexionPage({ searchParams }: ConnexionPageProps) {
  const { erreur, message, suite: suiteDemandee } = await searchParams;
  // Page où revenir ensuite (lien de défi d'un ami, audit N18) : chemin du site seulement.
  const suite = suiteDemandee ? destinationInterne(suiteDemandee, "") || null : null;

  return (
    <CadreCompte
      libelle="Compte joueur"
      titre="Se connecter"
      intro={<p>Retrouve ton classement vérifié.</p>}
      promesses
      alerte={
        erreur || message ? (
          <div className="flex flex-col gap-3">
            {message && <Alerte type="succes">{message}</Alerte>}
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          </div>
        ) : undefined
      }
      pied={
        <>
          Pas encore de compte ?{" "}
          <Link
            href={suite ? `/inscription?suite=${encodeURIComponent(suite)}` : "/inscription"}
            className="font-semibold text-text underline underline-offset-3 hover:text-accent"
          >
            Créer un compte
          </Link>
        </>
      }
    >
      <form action={seConnecter} className="flex flex-col gap-4">
        {suite && <input type="hidden" name="suite" value={suite} />}
        <ChampCompte libelle="E-mail">
          <input name="email" type="email" required autoComplete="email" className={classeChamp()} />
        </ChampCompte>
        <ChampCompte libelle="Mot de passe">
          <input name="mot_de_passe" type="password" required autoComplete="current-password" className={classeChamp()} />
        </ChampCompte>
        <BoutonEnvoi libelleEnCours="Connexion…" className="mt-2 w-full">
          Se connecter
        </BoutonEnvoi>
        <Link
          href="/mot-de-passe-oublie"
          className="inline-flex min-h-11 items-center self-start text-sm text-muted underline underline-offset-3 hover:text-text"
        >
          Mot de passe oublié ?
        </Link>
      </form>

      <SeparateurOu />

      <form action={seConnecterAvecDiscord} className="flex flex-col gap-4">
        {suite && <input type="hidden" name="suite" value={suite} />}
        <ConsentementCompte />
        <BoutonEnvoi variante="contour" libelleEnCours="Redirection…" className="w-full">
          Continuer avec Discord
        </BoutonEnvoi>
      </form>
    </CadreCompte>
  );
}
