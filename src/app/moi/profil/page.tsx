import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { modifierMonProfil, supprimerMonCompte } from "@/lib/profil-actions";
import { estPseudoAutomatique, prochainChangementPseudo } from "@/lib/pseudo";
import { formaterDate } from "@/lib/tournois";
import { URL_SITE } from "@/lib/notifications";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

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

const CHAMP =
  "min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint read-only:text-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      <div className="relative px-grille *:max-w-xl">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← Mon compte
          </Link>

          <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Modifier mon profil
          </h1>
          <p className="mt-2 text-sm text-muted">
            Ton pseudo est le nom affiché sur ton CV, dans les brackets et au classement.
          </p>

          {erreur && (
            <p role="alert" className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>
              {erreur}
            </p>
          )}
          {message && (
            <p role="status" className={"mt-6 " + classeCarte("atteste") + " text-sm text-accent"}>
              {message}
            </p>
          )}

          <form action={modifierMonProfil} className="mt-6 flex flex-col gap-6">
            <label className="flex flex-col gap-1">
              <span className="font-texte text-mini font-medium text-muted uppercase">Pseudo</span>
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
                className={CHAMP}
              />
              <span id="aide-pseudo" className="text-xs leading-relaxed text-muted">
                {prochainChangement ? (
                  <>
                    Prochain changement de pseudo possible le{" "}
                    <span className="tabular-nums">{formaterDate(prochainChangement.toISOString())}</span> (un
                    tous les 30 jours).
                  </>
                ) : pseudoAutomatique ? (
                  <>
                    Ton compte porte encore le pseudo automatique « {profil.pseudo} ». 3 à 20 caractères : lettres,
                    chiffres, espaces, - ou _.
                  </>
                ) : (
                  <>
                    3 à 20 caractères : lettres, chiffres, espaces, - ou _. Un changement tous les 30 jours ; ton
                    CV change d&apos;adresse ({adresse}) et l&apos;ancienne continue de mener à toi.
                  </>
                )}
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-texte text-mini font-medium text-muted uppercase">Pays (facultatif)</span>
              <input
                name="pays"
                type="text"
                maxLength={40}
                list="pays-suggeres"
                defaultValue={profil.pays ?? ""}
                autoComplete="country-name"
                className={CHAMP}
              />
              <datalist id="pays-suggeres">
                {PAYS_SUGGERES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>

            <label className="flex items-start gap-3 text-sm text-text-2">
              <input
                name="visites_anonymes"
                type="checkbox"
                defaultChecked={reglages?.visites_anonymes ?? false}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <span>
                <span className="font-semibold text-text">Visites anonymes</span> — quand tu consultes le profil
                d&apos;un joueur, tu n&apos;apparais pas dans sa liste « Qui a vu ton profil ». Tes visites déjà
                enregistrées sont effacées.
              </span>
            </label>

            <Bouton libelleEnCours="Enregistrement…" className="self-start">
              Enregistrer
            </Bouton>
          </form>

          <p className="mt-10 text-sm leading-relaxed text-muted">
            Riot ID :{" "}
            <Link href="/lier-riot" className="text-text underline underline-offset-3">
              lier ou vérifier mon compte
            </Link>
            . Bio et lien externe : sur{" "}
            <Link href={`/joueur/${profil.slug}#personnaliser`} className="text-text underline underline-offset-3">
              ton profil public
            </Link>{" "}
            (offre Vérifié).
          </p>

          <section aria-labelledby="titre-suppression" className="mt-14 border-t border-line pt-8">
            <h2 id="titre-suppression" className="font-titre text-2xl font-extrabold uppercase text-text">
              Supprimer mon compte
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Sont effacés : ton pseudo, ton pays, ton compte Riot, ton rating et ta place au classement, tes
              équipes dont tu es le seul membre, ton annonce, tes visites, ta liste de suivi et ton adresse de
              connexion. Restent affichés sous un pseudo anonyme (« Supprime-… ») : tes matchs déjà joués et le
              journal public de tes points, qui font partie de l&apos;historique des autres joueurs, ainsi que
              les messages que tu as envoyés. C&apos;est définitif.
            </p>
            <form action={supprimerMonCompte} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-texte text-mini font-medium text-muted uppercase">
                  Écris SUPPRIMER pour confirmer
                </span>
                <input name="confirmation" type="text" required autoComplete="off" className={CHAMP} />
              </label>
              <BoutonConfirmation
                type="submit"
                confirmation="Supprimer définitivement ton compte ? Tu seras déconnecté et ne pourras plus t'y reconnecter."
                className="inline-flex min-h-11 items-center self-start font-texte text-mini font-semibold text-danger uppercase underline underline-offset-3"
              >
                Supprimer mon compte
              </BoutonConfirmation>
            </form>
          </section>
        </Apparition>
      </div>
    </main>
  );
}
