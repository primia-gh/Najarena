import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { COMMUNAUTES_MAX_PAR_ORGANISATEUR, COULEUR_COMMUNAUTE_DEFAUT } from "@/lib/communautes";
import { creerCommunaute } from "@/lib/communaute-actions";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import { Champ } from "@/components/design/Formulaire";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

// Création d'un espace communauté (audit N30) : offre Organisateur, trois
// communautés au plus — vérifié par la base (creer_communaute).

export const metadata: Metadata = {
  title: "Créer une communauté — Najarena",
  robots: { index: false, follow: false },
};

interface NouvelleCommunauteProps {
  searchParams: Promise<{ erreur?: string }>;
}

export default async function NouvelleCommunautePage({ searchParams }: NouvelleCommunauteProps) {
  const { erreur } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Fcommunaute%2Fnouvelle");
  const { offre } = await chargerOffre(supabase, userData.user.id);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-xl">
        <Apparition>
          <Link
            href="/communautes"
            className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Communautés
          </Link>
          <LibelleSection className="mt-6">Offre Organisateur</LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase">Créer une communauté</h1>
          <p className="mt-4 text-text-2">
            Une page pour ton serveur Discord ou ton association : vos tournois, votre classement interne et vos
            membres. {COMMUNAUTES_MAX_PAR_ORGANISATEUR} communautés au plus.
          </p>
          <p className="mt-3 text-sm text-muted">
            Association d&apos;une école ou d&apos;une université ? Une fois la communauté créée, indique le domaine
            des adresses de l&apos;établissement depuis sa page : elle devient une école et entre dans la{" "}
            <Link href="/lol/ecoles" className="text-text underline underline-offset-3 hover:text-accent">
              ligue des écoles
            </Link>
            .
          </p>
        </Apparition>

        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <Apparition delai={0.06}>
          {offre !== "organisateur" ? (
            <Panneau className="flex flex-col items-start gap-4 p-6">
              <p className="text-text-2">
                La création d&apos;une communauté fait partie de l&apos;offre Organisateur. Rejoindre une communauté
                reste gratuit pour tout le monde.
              </p>
              <BoutonLien href="/tarifs">Voir les offres</BoutonLien>
            </Panneau>
          ) : (
            <form action={creerCommunaute} className="flex flex-col gap-5">
              <Champ libelle="Nom">
                <input
                  name="nom"
                  required
                  minLength={3}
                  maxLength={40}
                  placeholder="Ex. Club LoL de Lyon"
                  className={classeChamp()}
                />
              </Champ>
              <Champ libelle="Description (publique, facultative)">
                <textarea name="description" rows={3} maxLength={500} className={`${classeChamp()} resize-y`} />
              </Champ>
              <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                <Champ libelle="Couleur">
                  <input
                    type="color"
                    name="couleur"
                    defaultValue={COULEUR_COMMUNAUTE_DEFAUT}
                    className="h-11 w-20 cursor-pointer rounded-bouton border border-line-strong bg-bg p-1"
                  />
                </Champ>
                <Champ libelle="Invitation Discord (facultative)">
                  <input type="url" name="lien_discord" placeholder="https://discord.gg/…" className={classeChamp()} />
                </Champ>
              </div>
              <BoutonEnvoi libelleEnCours="Création…" className="mt-2 self-start">
                Créer la communauté
              </BoutonEnvoi>
            </form>
          )}
        </Apparition>
      </div>
    </main>
  );
}
