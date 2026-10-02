import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { creerClientPublic } from "@/lib/supabase/public";
import { ajouterJours } from "@/lib/tournois-auto/creneaux";
import { estUnLundi, lundiDeLaSemaine, resumeCompetitions } from "@/lib/recap-semaine";
import { chargerRecapSemaine } from "@/lib/recap-semaine-serveur";
import { dateLongue } from "@/lib/saisons";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";

// Récap de la semaine (28/09/2026, audit N17) : une page par semaine,
// tirée du journal des points et des matchs vérifiés des tournois
// clôturés. Du contenu frais et indexable, sans effort humain.

interface SemainePageProps {
  params: Promise<{ lundi: string }>;
}

const charger = cache(async (lundi: string) => chargerRecapSemaine(creerClientPublic(), lundi));

function semaineValide(lundi: string): boolean {
  return estUnLundi(lundi) && lundi <= lundiDeLaSemaine(new Date());
}

export async function generateMetadata({ params }: SemainePageProps): Promise<Metadata> {
  const { lundi } = await params;
  if (!semaineValide(lundi)) return { title: "Semaine introuvable — Najarena" };
  const { recap } = await charger(lundi);
  const titre = `Récap de la semaine du ${dateLongue(`${lundi}T12:00:00Z`)} — Najarena`;
  if (!recap) return { title: titre, robots: { index: false, follow: true } };
  return {
    title: titre,
    description: `${resumeCompetitions(recap)} sur League of Legends, ${recap.matchsVerifies} matchs vérifiés : progressions, exploit et nouveaux paliers de la semaine sur Najarena.`,
    alternates: { canonical: `/lol/semaine/${lundi}` },
  };
}

export default async function RecapSemainePage({ params }: SemainePageProps) {
  const { lundi } = await params;
  if (!semaineValide(lundi)) notFound();

  const { recap, joueurs, tournois } = await charger(lundi);
  const precedente = ajouterJours(lundi, -7);
  const suivante = ajouterJours(lundi, 7);
  const suivanteExiste = suivante <= lundiDeLaSemaine(new Date());

  const joueur = (id: string) => {
    const j = joueurs.get(id);
    if (!j || j.supprime) return <span className="text-muted">Compte supprimé</span>;
    return (
      <Link href={`/joueur/${j.slug}`} className="font-semibold text-text hover:text-accent">
        {j.pseudo}
      </Link>
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille *:max-w-3xl">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">Récap de la semaine</span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Semaine du {dateLongue(`${lundi}T12:00:00Z`)}
          </h1>
          <nav aria-label="Autres semaines" className="mt-3 flex gap-5 text-sm text-muted">
            <Link href={`/lol/semaine/${precedente}`} className="underline underline-offset-3 hover:text-text">
              ← Semaine précédente
            </Link>
            {suivanteExiste && (
              <Link href={`/lol/semaine/${suivante}`} className="underline underline-offset-3 hover:text-text">
                Semaine suivante →
              </Link>
            )}
          </nav>
        </Apparition>

        <Apparition delai={0.08}>
          {!recap ? (
            <p className="mt-8 text-sm text-muted">
              Aucun tournoi clôturé cette semaine. Le classement ne bouge qu&apos;à la clôture d&apos;un tournoi.
            </p>
          ) : (
            <div className="mt-8 flex flex-col gap-4">
              <p className="text-sm text-text-2">
                <span className="tabular-nums">{resumeCompetitions(recap)}</span>,{" "}
                <span className="tabular-nums">{recap.matchsVerifies}</span> match
                {recap.matchsVerifies > 1 ? "s" : ""} vérifié{recap.matchsVerifies > 1 ? "s" : ""} dans la donnée
                officielle Riot.
              </p>

              {recap.progressions.length > 0 && (
                <Panneau as="section" className="flex flex-col gap-3 px-6 py-5">
                  <LibelleSection as="h2">Plus fortes progressions</LibelleSection>
                  <ol className="flex flex-col gap-1.5 text-sm">
                    {recap.progressions.map((p) => (
                      <li key={p.profileId}>
                        {joueur(p.profileId)} <span className="text-accent tabular-nums">+{p.gain}</span>
                      </li>
                    ))}
                  </ol>
                </Panneau>
              )}

              {recap.exploit && (
                <Panneau as="section" className="flex flex-col gap-3 px-6 py-5">
                  <LibelleSection as="h2">Exploit de la semaine</LibelleSection>
                  <p className="text-sm text-text-2">
                    {joueur(recap.exploit.gagnantId)} (
                    <span className="tabular-nums">{recap.exploit.chances} %</span> de chances estimées) bat{" "}
                    {joueur(recap.exploit.perdantId)}
                    {tournois.get(recap.exploit.tournoiId) && (
                      <>
                        {" "}
                        —{" "}
                        <Link
                          href={`/lol/tournois/${tournois.get(recap.exploit.tournoiId)!.slug}`}
                          className="underline underline-offset-3 hover:text-text"
                        >
                          {tournois.get(recap.exploit.tournoiId)!.nom}
                        </Link>
                      </>
                    )}
                    .
                  </p>
                </Panneau>
              )}

              {recap.nouveauxPaliers.length > 0 && (
                <Panneau as="section" className="flex flex-col gap-3 px-6 py-5">
                  <LibelleSection as="h2">Nouveaux paliers</LibelleSection>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {recap.nouveauxPaliers.map((p) => (
                      <li key={p.profileId}>
                        {joueur(p.profileId)} → <span className="font-semibold">{p.palier}</span>
                      </li>
                    ))}
                  </ul>
                </Panneau>
              )}

              {recap.actifs.length > 0 && (
                <Panneau as="section" className="flex flex-col gap-3 px-6 py-5">
                  <LibelleSection as="h2">Les plus actifs</LibelleSection>
                  <ol className="flex flex-col gap-1.5 text-sm">
                    {recap.actifs.map((a) => (
                      <li key={a.profileId}>
                        {joueur(a.profileId)} — <span className="tabular-nums">{a.matchs}</span> match
                        {a.matchs > 1 ? "s" : ""} vérifié{a.matchs > 1 ? "s" : ""}
                      </li>
                    ))}
                  </ol>
                </Panneau>
              )}
            </div>
          )}
        </Apparition>
      </div>
    </main>
  );
}
