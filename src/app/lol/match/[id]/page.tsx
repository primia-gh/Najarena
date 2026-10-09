import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { arrondir } from "@/lib/classement";
import { formaterDate } from "@/lib/tournois";
import { empreinteCourte } from "@/lib/registre";
import { libelleTour } from "@/lib/bracket-image";
import { chargerPreuveMatch, type PreuveMatch } from "@/lib/preuve-match";
import Apparition from "@/components/design/Apparition";
import { BadgeVerdict } from "@/components/design/Badges";
import BoutonCopier from "@/components/design/BoutonCopier";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";

// Fiche de preuve d'un match (09/10/2026, idée en réserve n°1) : une
// adresse par match, pour montrer d'où vient un résultat. Page outil, dense,
// sans animation superflue. Un verdict manuel n'est jamais présenté comme
// vérifié (CLAUDE.md §3 et §7).

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const preuve = await chargerPreuveMatch(id);
  if (!preuve) return { title: "Match introuvable — Najarena" };
  return {
    title: `Preuve du match ${preuve.joueurs.map((j) => j.pseudo).join(" contre ")} — Najarena`,
    description: `D'où vient le résultat de ce match du tournoi ${preuve.tournoi.nom} : verdict, partie Riot, registre des points.`,
    robots: { index: false, follow: true },
  };
}

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
      <dt className="font-texte text-mini font-medium text-muted uppercase">{libelle}</dt>
      <dd className="text-sm text-text [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Ce que dit le classement de ce match, en une phrase. */
function etatClassement(p: PreuveMatch): string {
  if (p.tournoi.format === "5v5") return "Tournoi 5v5 : jamais compté au classement individuel.";
  if (!p.verdict) return "Pas encore de résultat.";
  if (p.verdict.niveau === "manuel") return "Ne compte pas au classement : un verdict manuel n'écrit jamais de points.";
  if (p.tournoi.classe === false) return "Tournoi non classé : aucun point en jeu.";
  if (p.tournoi.classe === true) return "Compté au classement, à la clôture du tournoi.";
  return p.tournoi.nature === "defi"
    ? "Les points s'écrivent à la clôture du duel."
    : "Les points s'écrivent à la clôture du tournoi (période de notation = le tournoi).";
}

function duree(secondes: number): string {
  return `${Math.floor(secondes / 60)} min ${String(secondes % 60).padStart(2, "0")} s`;
}

export default async function PreuveMatchPage({ params }: PageProps) {
  const { id } = await params;
  const preuve = await chargerPreuveMatch(id);
  if (!preuve) notFound();
  const { verdict, tournoi } = preuve;
  const titre = preuve.joueurs.length === 2 ? preuve.joueurs.map((j) => j.pseudo).join(" contre ") : "Match à venir";
  const tourLisible =
    tournoi.nature === "tournoi" ? libelleTour(preuve.tour, preuve.dernierTour).toLowerCase() : "duel en une partie";

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-4xl">
        <Apparition>
          <Link
            href={`/lol/tournois/${tournoi.slug}`}
            className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            {tournoi.nom}
          </Link>
          <LibelleSection className="mt-6">Preuve du match</LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase [overflow-wrap:anywhere]">{titre}</h1>
          <p className="mt-3 text-sm text-muted">
            {tournoi.nom} · {tourLisible}
            {preuve.demarreLe && <> · ouvert le <span className="tabular-nums">{formaterDate(preuve.demarreLe)}</span></>}
          </p>
        </Apparition>

        <Apparition delai={0.04}>
          <Panneau className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <LibelleSection as="h2">Verdict</LibelleSection>
              {verdict && <BadgeVerdict niveau={verdict.niveau} />}
            </div>
            {!verdict ? (
              <p className="text-text-2">
                {preuve.statut === "litige"
                  ? "Litige : la partie n'a pas été retrouvée chez Riot, l'organisateur doit trancher."
                  : "Pas encore de résultat : la partie est cherchée dans l'historique Riot des deux joueurs."}
              </p>
            ) : (
              <dl className="flex flex-col">
                <Ligne libelle="Vainqueur">{verdict.gagnant ?? "Aucun (double forfait)"}</Ligne>
                {verdict.niveau === "historique" && (
                  <Ligne libelle="Source">Partie retrouvée dans l&apos;historique officiel Riot des deux comptes.</Ligne>
                )}
                {verdict.niveau === "code_tournoi" && <Ligne libelle="Source">Partie jouée avec un code de tournoi Riot.</Ligne>}
                {verdict.niveau === "manuel" && (
                  <>
                    <Ligne libelle="Source">
                      Décision manuelle{verdict.decideur ? ` de ${verdict.decideur}` : " (appliquée automatiquement par Najarena)"}.
                    </Ligne>
                    <Ligne libelle="Motif">{verdict.motif ?? "—"}</Ligne>
                  </>
                )}
                <Ligne libelle={verdict.niveau === "manuel" ? "Décidé le" : "Lu chez Riot le"}>
                  <span className="tabular-nums">{formaterDate(verdict.decideLe)}</span>
                </Ligne>
                {verdict.riotMatchId && (
                  <Ligne libelle="Partie Riot">
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <code className="font-texte tabular-nums">{verdict.riotMatchId}</code>
                      <BoutonCopier
                        texte={verdict.riotMatchId}
                        libelle="Copier"
                        libelleAccessible="Copier l'identifiant de la partie Riot"
                      />
                    </span>
                  </Ligne>
                )}
                {preuve.dureeSecondes !== null && <Ligne libelle="Durée de la partie">{duree(preuve.dureeSecondes)}</Ligne>}
                {preuve.defaiteReconnue && (
                  <Ligne libelle="Défaite reconnue">
                    par {preuve.defaiteReconnue.pseudo}
                    {preuve.defaiteReconnue.le && (
                      <>
                        {" "}
                        le <span className="tabular-nums">{formaterDate(preuve.defaiteReconnue.le)}</span>
                      </>
                    )}
                  </Ligne>
                )}
                <Ligne libelle="Classement">{etatClassement(preuve)}</Ligne>
              </dl>
            )}
          </Panneau>
        </Apparition>

        {preuve.joueurs.length > 0 && (
          <Apparition delai={0.08}>
            <section aria-labelledby="titre-joueurs" className="flex flex-col gap-4">
              <LibelleSection as="h2" id="titre-joueurs" className="border-b border-line-strong pb-4">
                Joueurs et comptes Riot
              </LibelleSection>
              <Tableau legende={`Joueurs du match ${titre}`}>
                <thead>
                  <tr>
                    <th scope="col">Joueur</th>
                    <th scope="col">Compte qui a joué</th>
                    <th scope="col">Champion</th>
                    <th scope="col" className="text-right">
                      K/D/A
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preuve.joueurs.map((j) => (
                    <tr key={j.profileId}>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          {j.slug ? (
                            <Link href={`/joueur/${j.slug}`} className="font-semibold hover:text-accent">
                              {j.pseudo}
                            </Link>
                          ) : (
                            <span className="font-semibold">{j.pseudo}</span>
                          )}
                          {j.gagnant && <span className="text-mini font-semibold text-text-2 uppercase">Vainqueur</span>}
                        </span>
                      </td>
                      <td className="tabular-nums">{j.riotId ?? <span className="text-muted">—</span>}</td>
                      <td>{j.champion ?? <span className="text-muted">—</span>}</td>
                      <td className="text-right tabular-nums">{j.kda ?? <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </Tableau>
              <p className="text-xs text-muted">
                Comptes Riot vérifiés par l&apos;icône de profil. Champion et K/D/A : lus dans la fiche officielle de la
                partie, quand elle a été retrouvée.
              </p>
            </section>
          </Apparition>
        )}

        <Apparition delai={0.12}>
          <section aria-labelledby="titre-registre" className="flex flex-col gap-4">
            <LibelleSection as="h2" id="titre-registre" className="border-b border-line-strong pb-4">
              Registre des points
            </LibelleSection>
            {preuve.registre.length === 0 ? (
              <p className="text-sm text-text-2">{etatClassement(preuve)} Aucune ligne du registre pour l&apos;instant.</p>
            ) : (
              <>
                <Tableau legende="Lignes du registre scellé produites par ce tournoi pour ces joueurs">
                  <thead>
                    <tr>
                      <th scope="col">N°</th>
                      <th scope="col">Joueur</th>
                      <th scope="col" className="text-right">
                        Rating
                      </th>
                      <th scope="col">Empreinte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preuve.registre.map((l) => (
                      <tr key={l.numero}>
                        <td className="tabular-nums">{l.numero}</td>
                        <td>{l.pseudo}</td>
                        <td className="text-right whitespace-nowrap tabular-nums">
                          {arrondir(l.ratingAvant)} → {arrondir(l.ratingApres)}
                        </td>
                        <td>
                          <code className="font-texte text-xs text-muted tabular-nums" title={l.empreinte}>
                            {empreinteCourte(l.empreinte)}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tableau>
                <p className="text-xs text-muted">
                  {tournoi.nature === "defi"
                    ? "Points écrits à la clôture du duel."
                    : "Le rating se calcule à la clôture du tournoi : ces lignes portent sur tout le tournoi, pas sur ce seul match."}{" "}
                  Chaque ligne est scellée : la modifier casserait la chaîne.{" "}
                  <Link href="/registre" className="text-text underline underline-offset-3 hover:text-accent">
                    Vérifier le registre
                  </Link>
                </p>
              </>
            )}
          </section>
        </Apparition>
      </div>
    </main>
  );
}
