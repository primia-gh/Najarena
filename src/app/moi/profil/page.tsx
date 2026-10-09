import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { modifierMonProfil, supprimerMonCompte } from "@/lib/profil-actions";
import { estPseudoAutomatique, prochainChangementPseudo } from "@/lib/pseudo";
import { formaterDate } from "@/lib/tournois";
import { URL_SITE } from "@/lib/notifications";
import { classeChamp } from "@/lib/design";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import FondEcailles from "@/components/design/FondEcailles";
import { Champ, Choix, GroupeFormulaire } from "@/components/design/Formulaire";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";

// Modifier mon profil (28/09/2026, audit E7) : pseudo, pays, visites
// anonymes. Les règles sont appliquées par la base (modifier_mon_profil).

export const metadata: Metadata = {
  title: "Modifier mon profil — Najarena",
  robots: { index: false, follow: false },
};

// Pays proposés à la saisie (le champ reste libre).
const PAYS_SUGGERES = [
  "France",
  "Belgique",
  "Suisse",
  "Luxembourg",
  "Canada",
  "Maroc",
  "Algérie",
  "Tunisie",
  "Sénégal",
  "Côte d'Ivoire",
  "Cameroun",
  "Monaco",
];

interface ModifierProfilPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function ModifierProfilPage({ searchParams }: ModifierProfilPageProps) {
  const { erreur, message } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const [{ data: profil }, { data: reglages }] = await Promise.all([
    supabase.from("profiles").select("pseudo, slug, pays").eq("id", userData.user.id).maybeSingle(),
    supabase.rpc("mes_reglages_profil").maybeSingle(),
  ]);
  if (!profil) {
    redirect("/moi");
  }

  const pseudoAutomatique = estPseudoAutomatique(profil.pseudo);
  const prochainChangement = prochainChangementPseudo(reglages?.pseudo_modifie_le ?? null);
  const adresse = `${URL_SITE.replace(/^https?:\/\//, "")}/joueur/${profil.slug}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-xl">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Mon compte
          </Link>
          <LibelleSection className="mt-6">Réglages</LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase">Modifier mon profil</h1>
          <p className="mt-4 text-text-2">Ton pseudo est le nom affiché sur ton CV, dans les brackets et au classement.</p>
        </Apparition>

        {(erreur || message) && (
          <div className="flex flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        <Apparition delai={0.06}>
          <form action={modifierMonProfil} className="flex flex-col gap-12">
            <GroupeFormulaire numero="01" titre="Identité" id="groupe-identite">
              <Champ
                libelle="Pseudo"
                idAide="aide-pseudo"
                aide={
                  prochainChangement ? (
                    <>
                      Prochain changement de pseudo possible le{" "}
                      <span className="tabular-nums">{formaterDate(prochainChangement.toISOString())}</span> (un tous
                      les 30 jours).
                    </>
                  ) : pseudoAutomatique ? (
                    <>
                      Ton compte porte encore le pseudo automatique « {profil.pseudo} ». 3 à 20 caractères : lettres,
                      chiffres, espaces, - ou _.
                    </>
                  ) : (
                    <>
                      3 à 20 caractères : lettres, chiffres, espaces, - ou _. Un changement tous les 30 jours ; ton CV
                      change d&apos;adresse ({adresse}) et l&apos;ancienne continue de mener à toi.
                    </>
                  )
                }
              >
                <input
                  name="pseudo"
                  type="text"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9 _\-]{3,20}"
                  defaultValue={profil.pseudo}
                  readOnly={prochainChangement !== null}
                  aria-describedby="aide-pseudo"
                  className={`${classeChamp()} read-only:text-muted`}
                />
              </Champ>

              <Champ libelle="Pays (facultatif)">
                <input
                  name="pays"
                  type="text"
                  maxLength={40}
                  list="pays-suggeres"
                  defaultValue={profil.pays ?? ""}
                  autoComplete="country-name"
                  className={classeChamp()}
                />
              </Champ>
              <datalist id="pays-suggeres">
                {PAYS_SUGGERES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </GroupeFormulaire>

            <GroupeFormulaire numero="02" titre="Confidentialité" id="groupe-confidentialite">
              <Choix
                type="checkbox"
                name="visites_anonymes"
                value="on"
                defaultChecked={reglages?.visites_anonymes ?? false}
                titre="Visites anonymes"
                detail="Quand tu consultes le profil d'un joueur, tu n'apparais pas dans sa liste « Qui a vu ton profil ». Tes visites déjà enregistrées sont effacées."
              />
            </GroupeFormulaire>

            <BoutonEnvoi libelleEnCours="Enregistrement…" className="self-start">
              Enregistrer
            </BoutonEnvoi>
          </form>
        </Apparition>

        <p className="text-sm leading-relaxed text-muted">
          Riot ID :{" "}
          <Link href="/lier-riot" className="text-text underline underline-offset-3 hover:text-accent">
            lier ou vérifier mon compte
          </Link>
          . Bio et lien externe : sur{" "}
          <Link
            href={`/joueur/${profil.slug}#personnaliser`}
            className="text-text underline underline-offset-3 hover:text-accent"
          >
            ton profil public
          </Link>{" "}
          (offre Vérifié).
        </p>

        <section aria-labelledby="titre-suppression" className="flex flex-col gap-4 rounded-carte border border-danger/30 p-6">
          <h2 id="titre-suppression" className="inline-flex items-center gap-2 font-texte text-libelle font-medium text-danger uppercase">
            <Icone nom="alerte" taille={14} />
            Supprimer mon compte
          </h2>
          <p className="text-sm leading-relaxed text-text-2">
            Sont effacés : ton pseudo, ton pays, ton compte Riot, ton rating et ta place au classement, tes équipes dont
            tu es le seul membre, ton annonce, tes visites, ta liste de suivi et ton adresse de connexion. Restent
            affichés sous un pseudo anonyme (« Supprime-… ») : tes matchs déjà joués et le journal public de tes points,
            qui font partie de l&apos;historique des autres joueurs, ainsi que les messages que tu as envoyés.
            C&apos;est définitif.
          </p>
          <form action={supprimerMonCompte} className="flex flex-col gap-3">
            <Champ libelle="Écris SUPPRIMER pour confirmer">
              <input name="confirmation" type="text" required autoComplete="off" className={classeChamp()} />
            </Champ>
            <BoutonConfirmation
              type="submit"
              confirmation="Supprimer définitivement ton compte ? Tu seras déconnecté et ne pourras plus t'y reconnecter."
              className="inline-flex min-h-11 cursor-pointer items-center self-start rounded-bouton border border-danger/60 px-5 font-texte text-[13px] font-semibold tracking-[2px] text-danger uppercase transition-colors duration-200 hover:bg-danger/10"
            >
              Supprimer mon compte
            </BoutonConfirmation>
          </form>
        </section>
      </div>
    </main>
  );
}
