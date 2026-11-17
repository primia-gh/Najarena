import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RD_SEUIL_CLASSEMENT } from "@/lib/classement";
import { etatMeteo, formaterDecimal, LIBELLE_ETAT, partVerifiee } from "@/lib/meteo";
import Apparition from "@/components/design/Apparition";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";

// Météo du classement (09/10/2026, idée en réserve n°5) : la précision du
// classement, en chiffres publics. Page outil, dense, sans animation
// superflue. Des nombres seulement, jamais de noms.

export const metadata: Metadata = {
  title: "Météo du classement — Najarena",
  description:
    "À quel point le classement Najarena est déjà précis : matchs par joueur actif, part des résultats lus chez Riot, incertitude des joueurs.",
  alternates: { canonical: "/lol/meteo" },
};

// Toujours à jour : chiffres lus à chaque visite.
export const dynamic = "force-dynamic";

const JOUR_SEMAINE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function Tuile({ libelle, valeur, detail }: { libelle: string; valeur: string; detail: string }) {
  return (
    <Panneau className="flex flex-col gap-2 p-6">
      <span className="font-texte text-mini font-medium text-muted uppercase">{libelle}</span>
      <span className="font-titre text-5xl leading-none font-black tabular-nums">{valeur}</span>
      <span className="text-xs leading-normal text-muted">{detail}</span>
    </Panneau>
  );
}

export default async function MeteoPage() {
  const supabase = await createClient();
  const [{ data: meteo }, { data: semaines }] = await Promise.all([
    supabase.rpc("meteo_classement").maybeSingle(),
    supabase.rpc("meteo_semaines", { p_semaines: 8 }),
  ]);

  const etat = meteo ? etatMeteo(meteo) : "sans_donnees";
  const part = meteo ? partVerifiee(meteo.matchs_30j, meteo.matchs_verifies_30j) : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition className="flex flex-col gap-5">
          <LibelleSection>Preuve{meteo?.saison ? ` · ${meteo.saison}` : ""}</LibelleSection>
          <h1 className="font-titre text-section font-black tracking-[1px] uppercase">Météo du classement</h1>
          <p className="max-w-2xl text-courant text-text-2">
            Un classement n&apos;est précis que si chaque joueur a disputé assez de matchs vérifiés. Voici où en est le
            nôtre, sans rien arranger : ces chiffres sont calculés par la base à chaque visite.
          </p>
        </Apparition>

        <Apparition delai={0.04}>
          <Panneau reperes className="flex max-w-3xl flex-col gap-3 p-7">
            <span className="font-texte text-mini font-medium text-muted uppercase">État du classement</span>
            <span className="font-titre text-sous-titre leading-none font-black uppercase">{LIBELLE_ETAT[etat].titre}</span>
            <p className="text-text-2">{LIBELLE_ETAT[etat].texte}</p>
            {meteo && meteo.rd_median !== null && (
              <p className="text-xs text-muted">
                Règle : incertitude médiane (RD) des joueurs notés de <span className="tabular-nums">{formaterDecimal(meteo.rd_median)}</span>.
                « Solide » à {RD_SEUIL_CLASSEMENT} ou moins (seuil d&apos;entrée au classement), « en construction » jusqu&apos;à
                250, « encore jeune » au-delà.
              </p>
            )}
          </Panneau>
        </Apparition>

        {meteo && (
          <Apparition delai={0.08}>
            <section aria-labelledby="titre-chiffres" className="flex flex-col gap-4">
              <LibelleSection as="h2" id="titre-chiffres" className="border-b border-line-strong pb-4">
                Les 30 derniers jours
              </LibelleSection>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tuile
                  libelle="Matchs par joueur actif"
                  valeur={formaterDecimal(meteo.matchs_par_actif_median)}
                  detail={`Médiane, sur ${meteo.joueurs_actifs_30j} joueur${meteo.joueurs_actifs_30j > 1 ? "s" : ""} actif${meteo.joueurs_actifs_30j > 1 ? "s" : ""}. C'est le chiffre qui fait la précision.`}
                />
                <Tuile
                  libelle="Résultats lus chez Riot"
                  valeur={part === null ? "—" : `${part} %`}
                  detail={`${meteo.matchs_verifies_30j} sur ${meteo.matchs_30j} matchs ; les autres, tranchés à la main, ne comptent pas.`}
                />
                <Tuile
                  libelle="Joueurs classés"
                  valeur={String(meteo.joueurs_classes)}
                  detail={`Sur ${meteo.joueurs_avec_rating} joueur${meteo.joueurs_avec_rating > 1 ? "s" : ""} noté${meteo.joueurs_avec_rating > 1 ? "s" : ""} cette saison (RD de ${RD_SEUIL_CLASSEMENT} ou moins).`}
                />
                <Tuile
                  libelle="Incertitude médiane"
                  valeur={formaterDecimal(meteo.rd_median)}
                  detail="RD Glicko-2 : plus il est bas, plus le niveau affiché est sûr."
                />
              </div>
            </section>
          </Apparition>
        )}

        {(semaines ?? []).length > 0 && (
          <Apparition delai={0.12}>
            <section aria-labelledby="titre-semaines" className="flex max-w-4xl flex-col gap-4">
              <LibelleSection as="h2" id="titre-semaines" className="border-b border-line-strong pb-4">
                Semaine par semaine
              </LibelleSection>
              <Tableau legende="Matchs, part vérifiée et joueurs actifs par semaine">
                <thead>
                  <tr>
                    <th scope="col">Semaine du</th>
                    <th scope="col" className="text-right">
                      Matchs
                    </th>
                    <th scope="col" className="text-right">
                      Lus chez Riot
                    </th>
                    <th scope="col" className="text-right">
                      Joueurs actifs
                    </th>
                    <th scope="col" className="text-right">
                      Matchs par joueur (moy.)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(semaines ?? []).map((s) => {
                    const p = partVerifiee(s.matchs, s.matchs_verifies);
                    return (
                      <tr key={s.semaine}>
                        <td className="tabular-nums">{JOUR_SEMAINE.format(new Date(`${s.semaine}T00:00:00Z`))}</td>
                        <td className="text-right tabular-nums">{s.matchs}</td>
                        <td className="text-right tabular-nums">{p === null ? "—" : `${p} %`}</td>
                        <td className="text-right tabular-nums">{s.joueurs_actifs}</td>
                        <td className="text-right tabular-nums">
                          {s.joueurs_actifs > 0 ? formaterDecimal(Math.round(((s.matchs * 2) / s.joueurs_actifs) * 10) / 10) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tableau>
              <p className="text-xs text-muted">
                Matchs 1v1 des tournois et des duels ; le 5v5 ne compte pas au classement individuel. Chaque match compte pour
                ses deux joueurs.{" "}
                <Link href="/comment-ca-marche" className="text-text underline underline-offset-3 hover:text-accent">
                  Comment le classement est calculé
                </Link>
              </p>
            </section>
          </Apparition>
        )}
      </div>
    </main>
  );
}
