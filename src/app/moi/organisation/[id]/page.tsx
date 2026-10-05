import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  confirmerInscription,
  marquerAbsent,
  genererBracket,
  resoudreLitige,
  publierTournoi,
  annulerTournoi,
} from "@/lib/organisation-actions";
import { LABEL_STATUT, estStatutPublic, formaterDate, partiesDate, type NiveauVerdict } from "@/lib/tournois";
import { libelleTour } from "@/lib/bracket-image";
import { classeChamp } from "@/lib/design";
import { SuiviTempsReel } from "@/components/SuiviTempsReel";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import { BadgeEnDirect, BadgeVerdict } from "@/components/design/Badges";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";
import CarteMatchCockpit from "@/components/organisation/CarteMatchCockpit";
import { libelleEquipe } from "@/lib/cinq-contre-cinq";
import DossierLitige, { lireSynthese } from "@/components/litige/DossierLitige";

export const metadata: Metadata = {
  title: "Cockpit organisateur — Najarena",
  robots: { index: false, follow: false },
};

interface CockpitPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function CockpitPage({ params, searchParams }: CockpitPageProps) {
  const { id } = await params;
  const { erreur, message } = await searchParams;

  const supabase = await createClient();

  // L'utilisateur et le tournoi ne dépendent pas l'un de l'autre — lancés
  // en parallèle plutôt qu'en série (correctif du 13/09/2026, même logique
  // que sur l'accueil).
  const [{ data: userData }, { data: tournoi }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("tournaments")
      .select("id, slug, nom, statut, capacite, region, debute_le, checkin_ouvre_le, organisateur_id, format")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!userData.user) {
    redirect("/connexion");
  }
  if (!tournoi) {
    notFound();
  }
  if (tournoi.organisateur_id !== userData.user.id) {
    redirect("/moi");
  }

  const [{ data: inscriptionsData }, { data: matchsData }, { count: nbAgentsConfirmes }] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, statut, profile_id, equipe_nom, equipe_tag, profile:profiles(pseudo, slug)")
      .eq("tournament_id", id)
      .order("inscrit_le", { ascending: true }),
    supabase
      .from("matches")
      .select(
        "id, tour, position, statut, match_participants(profile_id, slot, est_gagnant, profile:profiles(pseudo, slug))",
      )
      .eq("tournament_id", id)
      .order("tour", { ascending: true })
      .order("position", { ascending: true }),
    // Agents libres confirmés (audit N23) : regroupés en équipes au lancement.
    tournoi.format === "5v5"
      ? supabase
          .from("agents_libres")
          .select("profile_id", { count: "exact", head: true })
          .eq("tournament_id", id)
          .eq("statut", "confirme")
      : Promise.resolve({ count: 0 }),
  ]);
  const inscriptions = inscriptionsData ?? [];
  const matchs = matchsData ?? [];
  // Tournoi 5v5 (audit N21) : chaque capitaine inscrit représente son équipe.
  const equipeParCapitaine = new Map(
    inscriptions.filter((i) => i.equipe_nom).map((i) => [i.profile_id, libelleEquipe(i.equipe_tag, i.equipe_nom)]),
  );
  const nom = (profileId: string, pseudo: string | null | undefined) =>
    equipeParCapitaine.get(profileId) ?? pseudo ?? "Joueur inconnu";

  const matchIds = matchs.map((m) => m.id);

  const [{ data: verdictsData }, { data: litigesData }] = await Promise.all([
    matchIds.length > 0
      ? supabase
          .from("match_verdicts")
          .select("match_id, niveau, motif")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : Promise.resolve({ data: [] }),
    matchIds.length > 0
      ? supabase
          .from("disputes")
          .select("id, motif, resolution, match_id, ouvert_par:profiles!disputes_ouvert_par_fkey(pseudo)")
          .in("match_id", matchIds)
          .order("cree_le", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const verdictParMatch = new Map((verdictsData ?? []).map((v) => [v.match_id, v]));
  const litiges = litigesData ?? [];
  const litigesOuverts = litiges.filter((l) => !l.resolution);
  // Dossiers déjà préparés (audit N28).
  const { data: dossiersData } =
    litigesOuverts.length > 0
      ? await supabase
          .from("dossiers_litige")
          .select("dispute_id, faits, synthese")
          .in(
            "dispute_id",
            litigesOuverts.map((l) => l.id),
          )
      : { data: [] };
  const dossierParLitige = new Map(
    (dossiersData ?? []).map((d) => [d.dispute_id, { faits: d.faits, synthese: lireSynthese(d.synthese) }]),
  );

  const rounds = new Map<number, typeof matchs>();
  for (const m of matchs) {
    const liste = rounds.get(m.tour) ?? [];
    liste.push(m);
    rounds.set(m.tour, liste);
  }
  const toursOrdonnes = Array.from(rounds.keys()).sort((a, b) => a - b);
  const bracketGenere = matchs.length > 0;
  const nbConfirmes = inscriptions.filter((i) => i.statut === "confirme").length;
  const nbActifs = inscriptions.filter((i) => i.statut === "inscrit" || i.statut === "confirme").length;
  const equipesAgents = Math.floor((nbAgentsConfirmes ?? 0) / 5);
  const dernierTour = toursOrdonnes.at(-1) ?? 1;
  const matchsATrancher = matchs.filter((m) => m.statut === "litige" && !verdictParMatch.has(m.id)).length;
  const unite = tournoi.format === "5v5" ? "équipes" : "joueurs";
  const actionsAvantLancement = ["brouillon", "ouvert", "checkin"].includes(tournoi.statut);
  const debut = partiesDate(tournoi.debute_le);

  // Ordre de la page (revue visuelle du 05/10/2026) : pendant le tournoi,
  // ce qui attend une décision passe en premier (litiges, matchs à
  // trancher), puis le bracket, puis la liste des inscrits ; avant le
  // lancement, les inscrits et le check-in d'abord.
  const sectionLitiges =
    litigesOuverts.length > 0 ? (
      <section aria-labelledby="cockpit-litiges" className="flex flex-col gap-5">
        <LibelleSection as="h2" id="cockpit-litiges" className="border-b border-line-strong pb-4 text-danger!">
          Litiges ouverts · {litigesOuverts.length}
        </LibelleSection>
        <ul className="flex flex-col gap-4">
          {litigesOuverts.map((l) => (
            <li key={l.id} className="panneau border-l-2 border-l-danger p-5 sm:p-6">
              <p className="text-text-2">
                Ouvert par <span className="font-semibold text-text">{l.ouvert_par?.pseudo ?? "un joueur"}</span> :{" "}
                « {l.motif} »
              </p>
              <form action={resoudreLitige} className="mt-4 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <input type="hidden" name="dispute_id" value={l.id} />
                <input type="hidden" name="tournament_id" value={tournoi.id} />
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Résolution du litige ouvert par {l.ouvert_par?.pseudo ?? "un joueur"}</span>
                  <input name="resolution" type="text" required placeholder="Résolution (obligatoire)" className={classeChamp()} />
                </label>
                <BoutonEnvoi
                  aria-label={`Résoudre le litige ouvert par ${l.ouvert_par?.pseudo ?? "un joueur"}`}
                  libelleEnCours="Résolution…"
                >
                  Résoudre
                </BoutonEnvoi>
              </form>
              <DossierLitige disputeId={l.id} dossier={dossierParLitige.get(l.id) ?? null} depuis="cockpit" />
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const sectionBracket = (
    <section aria-labelledby="cockpit-bracket" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-strong pb-4">
        <LibelleSection as="h2" id="cockpit-bracket">
          Bracket
        </LibelleSection>
        {bracketGenere && (
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <BadgeVerdict niveau="historique" compact /> compte au classement
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeVerdict niveau="manuel" compact /> hors classement
            </span>
          </span>
        )}
      </div>

      {!bracketGenere ? (
        <div className="flex flex-col items-start gap-4">
          <p className="max-w-2xl text-text-2">
            {nbConfirmes} {tournoi.format === "5v5" ? "équipe" : "joueur"}
            {nbConfirmes === 1 ? "" : "s"} confirmé{tournoi.format === "5v5" ? "e" : ""}
            {nbConfirmes === 1 ? "" : "s"}. Têtes de série selon le rating à l&apos;inscription (le tirage au sort ne
            départage que les égalités).
          </p>
          {equipesAgents > 0 && (
            <p className="max-w-2xl text-sm text-muted">
              {nbAgentsConfirmes} agents libres confirmés : ils formeront {equipesAgents} équipe
              {equipesAgents > 1 ? "s" : ""} de cinq au lancement du bracket, équilibrée
              {equipesAgents > 1 ? "s" : ""} par rating et par rôle.
            </p>
          )}
          <form action={genererBracket}>
            <input type="hidden" name="tournament_id" value={tournoi.id} />
            <BoutonEnvoi disabled={nbConfirmes + equipesAgents < 2} libelleEnCours="Génération…">
              Générer le bracket
            </BoutonEnvoi>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {toursOrdonnes.map((tour) => (
            <div key={tour} className="flex flex-col gap-3">
              <h3 className="font-texte text-mini font-medium text-faint uppercase">{libelleTour(tour, dernierTour)}</h3>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {rounds.get(tour)!.map((m) => {
                  const verdict = verdictParMatch.get(m.id);
                  const participants = [...m.match_participants]
                    .sort((a, b) => a.slot - b.slot)
                    .map((p) => ({
                      profileId: p.profile_id,
                      nom: nom(p.profile_id, p.profile?.pseudo),
                      gagnant: p.est_gagnant,
                    }));
                  // Un litige à trancher s'affiche avec son formulaire ouvert :
                  // il prend deux colonnes pour ne pas s'écraser.
                  const aTrancher = !verdict && m.statut === "litige";
                  return (
                    <li key={m.id} className={aTrancher ? "sm:col-span-2" : undefined}>
                      <CarteMatchCockpit
                        matchId={m.id}
                        tournoiId={tournoi.id}
                        statut={m.statut}
                        participants={participants}
                        verdict={verdict ? { niveau: verdict.niveau as NiveauVerdict, motif: verdict.motif } : null}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const ETAT_INSCRIPTION: Record<string, { libelle: string; classe: string }> = {
    inscrit: { libelle: "En attente du check-in", classe: "text-muted" },
    confirme: { libelle: "Confirmé", classe: "text-text" },
    absent: { libelle: "Absent", classe: "text-danger" },
    retire: { libelle: "Retiré", classe: "text-faint" },
  };

  const sectionInscrits = (
    <section aria-labelledby="cockpit-inscrits" className="flex flex-col gap-4">
      <LibelleSection as="h2" id="cockpit-inscrits" className="border-b border-line-strong pb-4">
        Inscrits et check-in · {nbActifs}/{tournoi.capacite}
      </LibelleSection>
      {inscriptions.length === 0 ? (
        <p className="text-text-2">Aucune inscription pour l&apos;instant.</p>
      ) : (
        <Tableau legende={`Inscrits au tournoi ${tournoi.nom}`}>
          <thead>
            <tr>
              <th scope="col" className="w-12">
                N°
              </th>
              <th scope="col">{tournoi.format === "5v5" ? "Équipe" : "Joueur"}</th>
              <th scope="col">Check-in</th>
              <th scope="col" className="text-right!">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {inscriptions.map((i, index) => {
              const etat = ETAT_INSCRIPTION[i.statut] ?? { libelle: i.statut, classe: "text-muted" };
              const libelle = nom(i.profile_id, i.profile?.pseudo);
              return (
                <tr key={i.id}>
                  <td className="py-2! text-sm text-faint tabular-nums">{index + 1}</td>
                  <td className="py-2! font-semibold">
                    {i.profile?.slug ? (
                      <Link href={`/joueur/${i.profile.slug}`} className="hover:text-accent">
                        {libelle}
                      </Link>
                    ) : (
                      libelle
                    )}
                  </td>
                  <td className={`py-2! text-sm ${etat.classe}`}>
                    <span className="inline-flex items-center gap-1.5">
                      {i.statut === "confirme" && <Icone nom="coche" taille={14} />}
                      {etat.libelle}
                    </span>
                  </td>
                  <td className="py-2!">
                    <span className="flex items-center justify-end gap-4">
                      {/* Un joueur qui s'est désinscrit ne se réinscrit que lui-même. */}
                      {i.statut !== "confirme" && i.statut !== "retire" && (
                        <form action={confirmerInscription}>
                          <input type="hidden" name="registration_id" value={i.id} />
                          <input type="hidden" name="tournament_id" value={tournoi.id} />
                          <button
                            type="submit"
                            aria-label={`Confirmer l'inscription de ${libelle}`}
                            className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-text underline underline-offset-3 hover:text-accent"
                          >
                            Confirmer
                          </button>
                        </form>
                      )}
                      {i.statut !== "absent" && i.statut !== "retire" && (
                        <form action={marquerAbsent}>
                          <input type="hidden" name="registration_id" value={i.id} />
                          <input type="hidden" name="tournament_id" value={tournoi.id} />
                          <button
                            type="submit"
                            aria-label={`Marquer ${libelle} comme absent`}
                            className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
                          >
                            Absent
                          </button>
                        </form>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tableau>
      )}
    </section>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      {tournoi.statut !== "termine" && tournoi.statut !== "annule" && (
        <SuiviTempsReel
          canal={`cockpit-${tournoi.id}`}
          tables={["matches", "match_participants", "match_verdicts", "registrations", "disputes"]}
        />
      )}
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition className="flex flex-col gap-8 border-b border-line pb-10">
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center gap-2 self-start font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Mon compte
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <LibelleSection>Cockpit organisateur</LibelleSection>
                {tournoi.statut === "en_cours" ? (
                  <BadgeEnDirect />
                ) : (
                  <span className="font-texte text-mini font-semibold text-text-2 uppercase">
                    {tournoi.statut === "brouillon"
                      ? "Brouillon — non publié"
                      : estStatutPublic(tournoi.statut)
                        ? LABEL_STATUT[tournoi.statut]
                        : tournoi.statut}
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-titre text-sous-titre font-black uppercase [overflow-wrap:anywhere]">{tournoi.nom}</h1>
              <p className="mt-3 text-sm text-muted tabular-nums">
                {tournoi.format} · {tournoi.capacite} {unite} · {tournoi.region} · {formaterDate(tournoi.debute_le)}{" "}
                (heure de Paris)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {tournoi.statut !== "brouillon" && (
                <BoutonLien href={`/lol/tournois/${tournoi.slug}`} variante="contour">
                  Voir la page publique
                </BoutonLien>
              )}
              {/* Publier un brouillon, annuler avant le lancement (28/09/2026, audit M7). */}
              {tournoi.statut === "brouillon" && (
                <form action={publierTournoi}>
                  <input type="hidden" name="tournament_id" value={tournoi.id} />
                  <BoutonEnvoi libelleEnCours="Publication…">Publier le tournoi</BoutonEnvoi>
                </form>
              )}
              {actionsAvantLancement && (
                <form action={annulerTournoi}>
                  <input type="hidden" name="tournament_id" value={tournoi.id} />
                  <BoutonConfirmation
                    type="submit"
                    confirmation="Annuler ce tournoi ? Les inscrits seront prévenus. C'est définitif."
                    className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
                  >
                    Annuler le tournoi
                  </BoutonConfirmation>
                </form>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <dt className="font-texte text-mini font-medium text-faint uppercase">Inscrits</dt>
              <dd className="font-titre text-5xl leading-none font-black tabular-nums">
                {nbActifs}
                <span className="text-2xl text-muted">/{tournoi.capacite}</span>
              </dd>
            </div>
            <div className="flex flex-col gap-2">
              <dt className="font-texte text-mini font-medium text-faint uppercase">Check-in confirmés</dt>
              <dd className="font-titre text-5xl leading-none font-black tabular-nums">{nbConfirmes}</dd>
            </div>
            {bracketGenere ? (
              <>
                <div className="flex flex-col gap-2">
                  <dt className="font-texte text-mini font-medium text-faint uppercase">Matchs à trancher</dt>
                  <dd
                    className={`font-titre text-5xl leading-none font-black tabular-nums ${matchsATrancher > 0 ? "text-danger" : ""}`}
                  >
                    {matchsATrancher}
                  </dd>
                </div>
                <div className="flex flex-col gap-2">
                  <dt className="font-texte text-mini font-medium text-faint uppercase">Litiges ouverts</dt>
                  <dd
                    className={`font-titre text-5xl leading-none font-black tabular-nums ${litigesOuverts.length > 0 ? "text-danger" : ""}`}
                  >
                    {litigesOuverts.length}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <dt className="font-texte text-mini font-medium text-faint uppercase">Places libres</dt>
                  <dd className="font-titre text-5xl leading-none font-black tabular-nums">
                    {Math.max(0, tournoi.capacite - nbActifs)}
                  </dd>
                </div>
                <div className="flex flex-col gap-2">
                  <dt className="font-texte text-mini font-medium text-faint uppercase">
                    Début · {debut.jour} {debut.mois}
                  </dt>
                  <dd className="font-titre text-5xl leading-none font-black tabular-nums">{debut.heure}</dd>
                </div>
              </>
            )}
          </dl>
        </Apparition>

        {(erreur || message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        <Apparition delai={0.08} className="flex flex-col gap-14">
          {bracketGenere ? (
            <>
              {sectionLitiges}
              {sectionBracket}
              {sectionInscrits}
            </>
          ) : (
            <>
              {sectionInscrits}
              {sectionBracket}
              {sectionLitiges}
            </>
          )}
        </Apparition>
      </div>
    </main>
  );
}
