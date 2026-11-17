import Link from "next/link";
import type { Metadata } from "next";
import { destinationInterne } from "@/lib/redirection";
import { sInscrire, seConnecterAvecDiscord } from "@/lib/auth-actions";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import CadreCompte, { ChampCompte, SeparateurOu } from "@/components/compte/CadreCompte";
import ConsentementCompte from "@/components/compte/ConsentementCompte";

export const metadata: Metadata = {
  title: "Inscription — Najarena",
  description:
    "Crée ton compte Najarena pour t'inscrire aux tournois League of Legends et construire ton profil vérifié.",
  robots: { index: false, follow: false },
};

interface InscriptionPageProps {
  searchParams: Promise<{ erreur?: string; suite?: string }>;
}

export default async function InscriptionPage({ searchParams }: InscriptionPageProps) {
  const { erreur, suite: suiteDemandee } = await searchParams;
  // Page où revenir ensuite (lien de défi d'un ami, audit N18) : chemin du site seulement.
  const suite = suiteDemandee ? destinationInterne(suiteDemandee, "") || null : null;

  return (
    <CadreCompte
      libelle="Compte joueur · gratuit"
      titre="Créer un compte"
      intro={
        <>
          <p>Ton niveau, vérifié — dès ton premier tournoi.</p>
          <p className="text-muted">Le Riot ID se lie ensuite, depuis ton profil.</p>
        </>
      }
      promesses
      alerte={erreur ? <Alerte type="erreur">{erreur}</Alerte> : undefined}
      pied={
        <>
          Déjà un compte ?{" "}
          <Link
            href={suite ? `/connexion?suite=${encodeURIComponent(suite)}` : "/connexion"}
            className="font-semibold text-text underline underline-offset-3 hover:text-accent"
          >
            Se connecter
          </Link>
        </>
      }
    >
      <form action={sInscrire} className="flex flex-col gap-4">
        {suite && <input type="hidden" name="suite" value={suite} />}
        <ChampCompte libelle="Pseudo · 3 à 20 caractères">
          <input
            name="pseudo"
            type="text"
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            className={classeChamp()}
          />
        </ChampCompte>
        <ChampCompte libelle="E-mail">
          <input name="email" type="email" required autoComplete="email" className={classeChamp()} />
        </ChampCompte>
        <ChampCompte libelle="Mot de passe · 8 caractères min.">
          <input
            name="mot_de_passe"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={classeChamp()}
          />
        </ChampCompte>
        <ConsentementCompte />
        <BoutonEnvoi libelleEnCours="Création…" className="mt-2 w-full">
          Créer mon compte
        </BoutonEnvoi>
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
