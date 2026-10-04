import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { COMMUNAUTES_MAX_PAR_ORGANISATEUR, COULEUR_COMMUNAUTE_DEFAUT } from "@/lib/communautes";
import { creerCommunaute } from "@/lib/communaute-actions";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";

// Création d'un espace communauté (audit N30) : offre Organisateur, trois
// communautés au plus — vérifié par la base (creer_communaute).

export const metadata: Metadata = {
  title: "Créer une communauté — Najarena",
  robots: { index: false, follow: false },
};

const CHAMP =
  "min-h-11 w-full rounded-bouton border border-line-strong bg-bg px-3 py-2.5 font-texte text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      <div className="relative px-grille *:max-w-xl">
        <Apparition>
          <Link
            href="/communautes"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← Communautés
          </Link>
          <h1 className="mt-6 font-titre text-section font-black tracking-[1px] uppercase">Créer une communauté</h1>
          <p className="mt-2 text-sm text-muted">
            Une page pour ton serveur Discord ou ton association : vos tournois, votre classement interne et vos
            membres. Offre Organisateur, {COMMUNAUTES_MAX_PAR_ORGANISATEUR} communautés au plus.
          </p>
          <p className="mt-2 text-sm text-muted">
            Association d&apos;une école ou d&apos;une université ? Une fois la communauté créée, indique le domaine
            des adresses de l&apos;établissement depuis sa page : elle devient une école et entre dans la{" "}
            <Link href="/lol/ecoles" className="text-text underline underline-offset-3 hover:text-accent">
              ligue des écoles
            </Link>
            .
          </p>
        </Apparition>

        {erreur && (
          <p
            role="alert"
            className="mt-6 rounded-bouton border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {erreur}
          </p>
        )}

        {offre !== "organisateur" ? (
          <div className="mt-8 flex flex-col gap-4">
            <p className="text-sm text-text-2">
              La création d&apos;une communauté fait partie de l&apos;offre Organisateur. Rejoindre une communauté reste
              gratuit pour tout le monde.
            </p>
            <BoutonLien href="/tarifs" className="self-start">
              Voir les offres
            </BoutonLien>
          </div>
        ) : (
          <form action={creerCommunaute} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Nom</span>
              <input
                name="nom"
                required
                minLength={3}
                maxLength={40}
                placeholder="Ex. Club LoL de Lyon"
                className={CHAMP}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-mini text-muted uppercase">Description (publique, facultative)</span>
              <textarea name="description" rows={3} maxLength={500} className={`${CHAMP} resize-y`} />
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-mini text-muted uppercase">Couleur</span>
                <input
                  type="color"
                  name="couleur"
                  defaultValue={COULEUR_COMMUNAUTE_DEFAUT}
                  className="h-11 w-20 rounded-bouton border border-line-strong bg-bg"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-mini text-muted uppercase">Invitation Discord (facultative)</span>
                <input type="url" name="lien_discord" placeholder="https://discord.gg/…" className={CHAMP} />
              </label>
            </div>
            <BoutonEnvoi libelleEnCours="Création…" className="self-start">
              Créer la communauté
            </BoutonEnvoi>
          </form>
        )}
      </div>
    </main>
  );
}
