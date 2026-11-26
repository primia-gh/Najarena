import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { creerEquipe } from "@/lib/equipe-actions";
import { TAILLE_MAX_EQUIPE } from "@/lib/equipe";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import EnTetePage from "@/components/design/EnTetePage";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import FondEcailles from "@/components/design/FondEcailles";
import { Champ } from "@/components/design/Formulaire";

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
      <div className="relative flex flex-col gap-10 px-grille *:max-w-xl">
        <EnTetePage
          formulaire
          retour={{ href: "/moi", libelle: "Mon compte" }}
          surtitre="League of Legends · 5v5"
          titre="Créer une équipe"
          intro={
            <>
              Pour jouer les tournois 5v5 : c&apos;est toi qui y inscriras l&apos;équipe. Tu en es automatiquement le
              capitaine, avec jusqu&apos;à {TAILLE_MAX_EQUIPE - 1} coéquipiers à inviter ensuite.
            </>
          }
        />

        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <Apparition delai={0.06}>
          <form action={creerEquipe} className="flex flex-col gap-5">
            <Champ libelle="Nom de l'équipe">
              <input
                name="nom"
                type="text"
                required
                minLength={3}
                maxLength={40}
                placeholder="Ex. Les Barons du Mardi"
                className={classeChamp()}
              />
            </Champ>
            <Champ
              libelle="Tag"
              idAide="aide-tag"
              aide="2 à 5 caractères, affiché devant le nom de l'équipe."
            >
              <input
                name="tag"
                type="text"
                required
                minLength={2}
                maxLength={5}
                placeholder="Ex. BDM"
                aria-describedby="aide-tag"
                className={`${classeChamp()} max-w-40 uppercase`}
              />
            </Champ>
            <BoutonEnvoi libelleEnCours="Création…" className="mt-2 self-start">
              Créer l&apos;équipe
            </BoutonEnvoi>
          </form>
        </Apparition>
      </div>
    </main>
  );
}
