import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  confirmerInscription,
  marquerAbsent,
  genererBracket,
  enregistrerResultat,
  resoudreLitige,
  publierTournoi,
  annulerTournoi,
} from "@/lib/organisation-actions";
import { LABEL_STATUT, COULEUR_STATUT, LABEL_NIVEAU, COULEUR_NIVEAU, formaterDate } from "@/lib/tournois";
import { SuiviTempsReel } from "@/components/SuiviTempsReel";
import { classeCarte, accentDepuisCouleur } from "@/lib/ui";
import Badge from "@/components/ui/Badge";
import Bouton from "@/components/ui/Bouton";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import SectionTitre from "@/components/ui/SectionTitre";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
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
  const equipesAgents = Math.floor((nbAgentsConfirmes ?? 0) / 5);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      {tournoi.statut !== "termine" && tournoi.statut !== "annule" && (
        <SuiviTempsReel
          canal={`cockpit-${tournoi.id}`}
          tables={["matches", "match_participants", "match_verdicts", "registrations", "disputes"]}
        />
      )}
      <FondEcailles />
      <div className="relative px-grille">
      <Apparition>
      <Link
        href="/moi"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        ← Mon compte
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="font-texte text-libelle font-medium text-muted uppercase">
            Cockpit organisateur
          </span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            {tournoi.nom}
          </h1>
        </div>
        <Badge
          couleur={COULEUR_STATUT[tournoi.statut as keyof typeof COULEUR_STATUT] ?? "text-muted"}
          className="shrink-0"
        >
          {LABEL_STATUT[tournoi.statut as keyof typeof LABEL_STATUT] ?? tournoi.statut}
        </Badge>
      </div>

      <div className="mt-3 font-texte tabular-nums text-[0.78rem] text-muted">
        {tournoi.capacite} joueurs · {tournoi.region} · {formaterDate(tournoi.debute_le)}
      </div>

      {tournoi.statut !== "brouillon" && (
        <Link
          href={`/lol/tournois/${tournoi.slug}`}
          className="mt-1 inline-block text-sm text-muted underline underline-offset-3 hover:text-text"
        >
          Voir la page publique
        </Link>
      )}

      {/* Publier un brouillon, annuler avant le lancement (28/09/2026, audit M7). */}
      {["brouillon", "ouvert", "checkin"].includes(tournoi.statut) && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {tournoi.statut === "brouillon" && (
            <form action={publierTournoi}>
              <input type="hidden" name="tournament_id" value={tournoi.id} />
              <Bouton libelleEnCours="Publication…">Publier le tournoi</Bouton>
            </form>
          )}
          <form action={annulerTournoi}>
            <input type="hidden" name="tournament_id" value={tournoi.id} />
            <BoutonConfirmation
              type="submit"
              confirmation="Annuler ce tournoi ? Les inscrits seront prévenus. C'est définitif."
              className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-danger underline underline-offset-3"
            >
              Annuler le tournoi
            </BoutonConfirmation>
          </form>
        </div>
      )}

      {erreur && (
        <p role="alert" className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}
      {message && (
        <p role="status" className={"mt-6 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
      )}
      </Apparition>

      <Apparition delai={0.1}>
      <section className="mt-10">
        <SectionTitre>Inscrits et check-in</SectionTitre>
        {inscriptions.length === 0 ? (
          <div className="mt-3">
            <EtatVide illustration={<IllustrationEffectifVide />}>
              Aucune inscription pour l&apos;instant.
            </EtatVide>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {inscriptions.map((i) => (
              <li key={i.id} className={"flex items-center justify-between " + classeCarte("none")}>
                <span className="text-sm font-medium text-text">
                  {nom(i.profile_id, i.profile?.pseudo)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-texte tabular-nums text-mini text-muted uppercase">
                    {i.statut}
                  </span>
                  {/* Un joueur qui s'est désinscrit ne se réinscrit que lui-même. */}
                  {i.statut !== "confirme" && i.statut !== "retire" && (
                    <form action={confirmerInscription}>
                      <input type="hidden" name="registration_id" value={i.id} />
                      <input type="hidden" name="tournament_id" value={tournoi.id} />
                      <button
                        type="submit"
                        aria-label={`Confirmer l'inscription de ${nom(i.profile_id, i.profile?.pseudo)}`}
                        className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-accent underline underline-offset-3"
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
                        aria-label={`Marquer ${nom(i.profile_id, i.profile?.pseudo)} comme absent`}
                        className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-danger underline underline-offset-3"
                      >
                        Absent
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.15}>
      <section className="mt-10">
        <SectionTitre>Bracket</SectionTitre>
        {bracketGenere && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.78rem] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Niveau 2/3 — compte pour le classement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted" />
              Niveau 1 — décision manuelle, hors classement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Litige — en attente de ta décision
            </span>
          </div>
        )}

        {!bracketGenere ? (
          <div className={"mt-3 " + classeCarte("none")}>
            <p className="text-sm text-muted">
              {nbConfirmes} {tournoi.format === "5v5" ? "équipe" : "joueur"}
              {nbConfirmes === 1 ? "" : "s"} confirmé{tournoi.format === "5v5" ? "e" : ""}
              {nbConfirmes === 1 ? "" : "s"}. Têtes de série selon le rating à l&apos;inscription (le tirage au sort
              ne départage que les égalités).
            </p>
            {equipesAgents > 0 && (
              <p className="mt-2 text-sm text-muted">
                {nbAgentsConfirmes} agents libres confirmés : ils formeront {equipesAgents} équipe
                {equipesAgents > 1 ? "s" : ""} de cinq au lancement du bracket, équilibrée
                {equipesAgents > 1 ? "s" : ""} par rating et par rôle.
              </p>
            )}
            <form action={genererBracket} className="mt-3">
              <input type="hidden" name="tournament_id" value={tournoi.id} />
              <Bouton disabled={nbConfirmes + equipesAgents < 2} libelleEnCours="Génération…">
                Générer le bracket
              </Bouton>
            </form>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-6">
            {toursOrdonnes.map((tour) => (
              <div key={tour}>
                <span className="font-texte text-mini font-medium text-muted uppercase">
                  Tour {tour}
                </span>
                <ul className="mt-2 flex flex-col gap-2">
                  {rounds.get(tour)!.map((m) => {
                    const verdict = verdictParMatch.get(m.id);
                    const participants = [...m.match_participants].sort((a, b) => a.slot - b.slot);
                    const peutDecider = !verdict && participants.length === 2;
                    const accentMatch =
                      !verdict && m.statut === "litige"
                        ? "sceau"
                        : verdict
                          ? accentDepuisCouleur(COULEUR_NIVEAU[verdict.niveau])
                          : "none";

                    return (
                      <li key={m.id} className={classeCarte(accentMatch)}>
                        {participants.length === 0 ? (
                          <span className="text-sm text-muted">Match à venir</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {participants.map((p) => (
                              <div key={p.profile_id} className="flex items-center justify-between">
                                <span
                                  className={`text-sm ${p.est_gagnant ? "font-semibold text-text" : "text-text"}`}
                                >
                                  {nom(p.profile_id, p.profile?.pseudo)}
                                </span>
                              </div>
                            ))}
                            {participants.length === 1 && (
                              <span className="font-texte tabular-nums text-[0.7rem] text-muted">
                                En attente d&apos;adversaire
                              </span>
                            )}
                          </div>
                        )}

                        {!verdict && m.statut === "litige" && (
                          <p className="mt-2 border-t border-line pt-2 font-texte tabular-nums text-mini text-accent uppercase">
                            Résultat non retrouvé automatiquement — décision manuelle requise
                          </p>
                        )}

                        {verdict && (
                          <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
                            <Badge couleur={COULEUR_NIVEAU[verdict.niveau]}>{LABEL_NIVEAU[verdict.niveau]}</Badge>
                            {verdict.motif && (
                              <span className="text-[0.72rem] text-muted">{verdict.motif}</span>
                            )}
                          </div>
                        )}

                        {peutDecider && (
                          <form
                            action={enregistrerResultat}
                            className="mt-3 flex flex-col gap-2 border-t border-line pt-3"
                          >
                            <input type="hidden" name="match_id" value={m.id} />
                            <input type="hidden" name="tournament_id" value={tournoi.id} />
                            <fieldset className="flex flex-col gap-2">
                              <legend className="font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                                Déclarer le vainqueur —{" "}
                                {participants
                                  .map((p) => nom(p.profile_id, p.profile?.pseudo))
                                  .join(" vs ")}
                              </legend>
                              {participants.map((p) => (
                                <label
                                  key={p.profile_id}
                                  className="flex items-center gap-2 text-sm text-text"
                                >
                                  <input
                                    type="radio"
                                    name="gagnant_id"
                                    value={p.profile_id}
                                    required
                                    className="accent-accent"
                                  />
                                  {nom(p.profile_id, p.profile?.pseudo)}
                                </label>
                              ))}
                              <input
                                name="motif"
                                type="text"
                                required
                                aria-label={`Motif — ${participants
                                  .map((p) => nom(p.profile_id, p.profile?.pseudo))
                                  .join(" vs ")}`}
                                placeholder="Motif (obligatoire, affiché publiquement)"
                                className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              />
                            </fieldset>
                            <Bouton
                              aria-label={`Enregistrer le résultat — ${participants
                                .map((p) => nom(p.profile_id, p.profile?.pseudo))
                                .join(" vs ")}`}
                              libelleEnCours="Enregistrement…"
                              className="self-start"
                            >
                              Enregistrer le résultat
                            </Bouton>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
      </Apparition>

      {litigesOuverts.length > 0 && (
        <Apparition delai={0.2}>
        <section className="mt-10">
          <SectionTitre>Litiges ouverts</SectionTitre>
          <ul className="mt-3 flex flex-col gap-3">
            {litigesOuverts.map((l) => (
              <li key={l.id} className={classeCarte("sceau")}>
                <p className="text-sm text-text">
                  Ouvert par{" "}
                  <span className="font-medium">{l.ouvert_par?.pseudo ?? "un joueur"}</span> :{" "}
                  {l.motif}
                </p>
                <form action={resoudreLitige} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="dispute_id" value={l.id} />
                  <input type="hidden" name="tournament_id" value={tournoi.id} />
                  <label>
                    <span className="sr-only">
                      Résolution du litige ouvert par {l.ouvert_par?.pseudo ?? "un joueur"}
                    </span>
                    <input
                      name="resolution"
                      type="text"
                      required
                      placeholder="Résolution (obligatoire)"
                      className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />
                  </label>
                  <Bouton
                    aria-label={`Résoudre le litige ouvert par ${l.ouvert_par?.pseudo ?? "un joueur"}`}
                    libelleEnCours="Résolution…"
                    className="self-start"
                  >
                    Résoudre
                  </Bouton>
                </form>
                <DossierLitige disputeId={l.id} dossier={dossierParLitige.get(l.id) ?? null} depuis="cockpit" />
              </li>
            ))}
          </ul>
        </section>
        </Apparition>
      )}
      </div>
    </main>
  );
}
