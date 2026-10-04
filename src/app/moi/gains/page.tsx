import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { cashPrizesActifs, formaterEuros, LIBELLE_RANG } from "@/lib/dotations";
import { LIBELLE_STATUT_VERSEMENT, PAYS_VERSEMENT } from "@/lib/versements-stripe";
import { ouvrirCompteVersement } from "@/lib/versement-actions";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

// Mes gains (04/10/2026, audit N32) : les cash prizes gagnés et leur
// versement par Stripe, après vérification de l'identité par Stripe. Page
// inexistante tant que les cash prizes sont désactivés.

export const metadata: Metadata = {
  title: "Mes gains — Najarena",
  robots: { index: false, follow: false },
};

const CHAMP =
  "min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface GainsPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function GainsPage({ searchParams }: GainsPageProps) {
  if (!cashPrizesActifs()) notFound();
  const { erreur, message } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Fmoi%2Fgains");

  const [{ data: gainsData }, { data: compte }] = await Promise.all([
    supabase
      .from("versements_dotation")
      .select("tournament_id, rang, montant_centimes, statut, maj_le, dotation:dotations(sponsor_nom, tournament:tournaments(nom, slug))")
      .eq("profile_id", userData.user.id)
      .order("maj_le", { ascending: false }),
    supabase.from("comptes_versement").select("verifie, verifie_le").eq("profile_id", userData.user.id).maybeSingle(),
  ]);
  const gains = gainsData ?? [];
  const aRecevoir = gains.filter((g) => g.statut === "a_verser");

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-3xl">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← Mon compte
          </Link>
          <h1 className="mt-6 font-titre text-section font-black tracking-[1px] uppercase">Mes gains</h1>
          <p className="mt-3 text-courant text-text-2">
            Les dotations sont financées par des sponsors : l&apos;inscription aux tournois reste gratuite. Pour
            recevoir un gain, fais vérifier ton identité par Stripe, notre prestataire de paiement ; Najarena ne voit
            ni ta pièce d&apos;identité ni tes coordonnées bancaires.
          </p>
        </Apparition>

        {erreur && (
          <p role="alert" className="rounded-bouton border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {erreur}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-bouton border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
            {message}
          </p>
        )}

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">Gains</LibelleSection>
          {gains.length === 0 ? (
            <Panneau className="p-6">
              <p className="text-sm text-muted">
                Aucun gain pour l&apos;instant. Les tournois dotés affichent leur dotation sur leur page.
              </p>
            </Panneau>
          ) : (
            <ul className="flex flex-col gap-2">
              {gains.map((g) => (
                <li key={g.tournament_id}>
                  <Panneau className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span className="text-sm">
                      {g.dotation?.tournament ? (
                        <Link href={`/lol/tournois/${g.dotation.tournament.slug}`} className="font-semibold hover:text-accent">
                          {g.dotation.tournament.nom}
                        </Link>
                      ) : (
                        "Tournoi"
                      )}
                      <span className="text-muted">
                        {" "}
                        · {LIBELLE_RANG[g.rang] ?? `Rang ${g.rang}`}
                        {g.dotation?.sponsor_nom ? ` · offert par ${g.dotation.sponsor_nom}` : ""}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">
                      <span className="font-semibold">{formaterEuros(g.montant_centimes)}</span>{" "}
                      <span className={g.statut === "verse" ? "text-accent" : "text-muted"}>
                        · {LIBELLE_STATUT_VERSEMENT[g.statut] ?? g.statut}
                      </span>
                    </span>
                  </Panneau>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(aRecevoir.length > 0 || compte) && (
          <section className="flex flex-col gap-4">
            <LibelleSection as="h2">Vérification d&apos;identité</LibelleSection>
            {compte?.verifie ? (
              <Panneau className="p-5">
                <p className="text-sm text-text-2">
                  <span className="text-accent">✓</span> Identité vérifiée par Stripe. Tes gains te sont versés par un
                  administrateur, sur le compte bancaire que tu as indiqué à Stripe.
                </p>
              </Panneau>
            ) : (
              <Panneau className="flex flex-col gap-4 p-5">
                <p className="text-sm text-text-2">
                  {compte
                    ? "Ta vérification chez Stripe n'est pas terminée (ou Stripe demande une pièce de plus) : reprends-la."
                    : "Stripe te demandera une pièce d'identité et tes coordonnées bancaires, sur ses propres pages. Stripe réserve ces comptes aux personnes majeures."}
                </p>
                <form action={ouvrirCompteVersement} className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-mini text-muted uppercase">Pays de résidence</span>
                    <select name="pays" defaultValue="FR" className={CHAMP}>
                      {PAYS_VERSEMENT.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                  <BoutonEnvoi libelleEnCours="Ouverture…">
                    {compte ? "Reprendre la vérification" : "Vérifier mon identité chez Stripe"}
                  </BoutonEnvoi>
                </form>
                <p className="text-xs text-muted">Le pays ne se change plus une fois le compte ouvert chez Stripe.</p>
              </Panneau>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
