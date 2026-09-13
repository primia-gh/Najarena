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
} from "@/lib/organisation-actions";
import { LABEL_STATUT, COULEUR_STATUT, LABEL_NIVEAU, COULEUR_NIVEAU, formaterDate } from "@/lib/tournois";
import { SuiviTempsReel } from "@/components/SuiviTempsReel";
import { classeCarte, accentDepuisCouleur } from "@/lib/ui";
import Badge from "@/components/ui/Badge";
import Bouton from "@/components/ui/Bouton";
import SectionTitre from "@/components/ui/SectionTitre";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

export const metadata: Metadata = {
  title: "Cockpit organisateur — Najarena",
  robots: { index: false, follow: false },
};

interface CockpitPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}

export default async function CockpitPage({ params, searchParams }: CockpitPageProps) {
  const { id } = await params;
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: tournoi } = await supabase
    .from("tournaments")
    .select("id, slug, nom, statut, capacite, region, debute_le, checkin_ouvre_le, organisateur_id")
    .eq("id", id)
    .maybeSingle();

  if (!tournoi) {
    notFound();
  }
  if (tournoi.organisateur_id !== userData.user.id) {
    redirect("/moi");
  }

  const { data: inscriptionsData } = await supabase
    .from("registrations")
    .select("id, statut, profile:profiles(pseudo, slug)")
    .eq("tournament_id", id)
    .order("inscrit_le", { ascending: true });
  const inscriptions = inscriptionsData ?? [];

  const { data: matchsData } = await supabase
    .from("matches")
    .select(
      "id, tour, position, statut, match_participants(profile_id, slot, est_gagnant, profile:profiles(pseudo, slug))",
    )
    .eq("tournament_id", id)
    .order("tour", { ascending: true })
    .order("position", { ascending: true });
  const matchs = matchsData ?? [];

  const matchIds = matchs.map((m) => m.id);

  const { data: verdictsData } =
    matchIds.length > 0
      ? await supabase
          .from("match_verdicts")
          .select("match_id, niveau, motif")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : { data: [] };
  const verdictParMatch = new Map((verdictsData ?? []).map((v) => [v.match_id, v]));

  const { data: litigesData } =
    matchIds.length > 0
      ? await supabase
          .from("disputes")
          .select("id, motif, resolution, match_id, ouvert_par:profiles!disputes_ouvert_par_fkey(pseudo)")
          .in("match_id", matchIds)
          .order("cree_le", { ascending: false })
      : { data: [] };
  const litiges = litigesData ?? [];
  const litigesOuverts = litiges.filter((l) => !l.resolution);

  const rounds = new Map<number, typeof matchs>();
  for (const m of matchs) {
    const liste = rounds.get(m.tour) ?? [];
    liste.push(m);
    rounds.set(m.tour, liste);
  }
  const toursOrdonnes = Array.from(rounds.keys()).sort((a, b) => a - b);
  const bracketGenere = matchs.length > 0;
  const nbConfirmes = inscriptions.filter((i) => i.statut === "confirme").length;

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      {tournoi.statut !== "termine" && tournoi.statut !== "annule" && (
        <SuiviTempsReel
          canal={`cockpit-${tournoi.id}`}
          tables={["matches", "match_participants", "match_verdicts", "registrations", "disputes"]}
        />
      )}
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
      <Reveal>
      <Link
        href="/moi"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← Mon compte
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[0.64rem] tracking-[0.22em] text-ardoise uppercase">
            Cockpit organisateur
          </span>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
            {tournoi.nom}
          </h1>
        </div>
        <Badge
          couleur={COULEUR_STATUT[tournoi.statut as keyof typeof COULEUR_STATUT] ?? "text-ardoise"}
          className="shrink-0"
        >
          {LABEL_STATUT[tournoi.statut as keyof typeof LABEL_STATUT] ?? tournoi.statut}
        </Badge>
      </div>

      <div className="mt-3 font-mono text-[0.78rem] text-ardoise">
        {tournoi.capacite} joueurs · {tournoi.region} · {formaterDate(tournoi.debute_le)}
      </div>

      <Link
        href={`/lol/tournois/${tournoi.slug}`}
        className="mt-1 inline-block text-sm text-ardoise underline underline-offset-3 hover:text-encre"
      >
        Voir la page publique
      </Link>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
      )}
      </Reveal>

      <Reveal delai={0.1}>
      <section className="mt-10">
        <SectionTitre>Inscrits et check-in</SectionTitre>
        {inscriptions.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-ardoise"}>
            Aucune inscription pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {inscriptions.map((i) => (
              <li key={i.id} className={"flex items-center justify-between " + classeCarte("none")}>
                <span className="text-sm font-medium text-encre">
                  {i.profile?.pseudo ?? "Joueur inconnu"}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.66rem] text-ardoise uppercase">
                    {i.statut}
                  </span>
                  {i.statut !== "confirme" && (
                    <form action={confirmerInscription}>
                      <input type="hidden" name="registration_id" value={i.id} />
                      <input type="hidden" name="tournament_id" value={tournoi.id} />
                      <button
                        type="submit"
                        aria-label={`Confirmer l'inscription de ${i.profile?.pseudo ?? "ce joueur"}`}
                        className="font-mono text-[0.62rem] text-atteste underline underline-offset-3"
                      >
                        Confirmer
                      </button>
                    </form>
                  )}
                  {i.statut !== "absent" && (
                    <form action={marquerAbsent}>
                      <input type="hidden" name="registration_id" value={i.id} />
                      <input type="hidden" name="tournament_id" value={tournoi.id} />
                      <button
                        type="submit"
                        aria-label={`Marquer ${i.profile?.pseudo ?? "ce joueur"} comme absent`}
                        className="font-mono text-[0.62rem] text-sceau-texte underline underline-offset-3"
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
      </Reveal>

      <Reveal delai={0.15}>
      <section className="mt-10">
        <SectionTitre>Bracket</SectionTitre>
        {bracketGenere && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.78rem] text-ardoise">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-atteste" />
              Niveau 2/3 — compte pour le classement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ardoise" />
              Niveau 1 — décision manuelle, hors classement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sceau" />
              Litige — en attente de ta décision
            </span>
          </div>
        )}

        {!bracketGenere ? (
          <div className={"mt-3 " + classeCarte("none")}>
            <p className="text-sm text-ardoise">
              {nbConfirmes} joueur{nbConfirmes === 1 ? "" : "s"} confirmé
              {nbConfirmes === 1 ? "" : "s"}. Le tirage se fait aléatoirement
              entre les joueurs confirmés au moment de la génération.
            </p>
            <form action={genererBracket} className="mt-3">
              <input type="hidden" name="tournament_id" value={tournoi.id} />
              <Bouton disabled={nbConfirmes < 2} libelleEnCours="Génération…">
                Générer le bracket
              </Bouton>
            </form>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-6">
            {toursOrdonnes.map((tour) => (
              <div key={tour}>
                <span className="font-mono text-[0.64rem] tracking-[0.14em] text-ardoise uppercase">
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
                          <span className="text-sm text-ardoise">Match à venir</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {participants.map((p) => (
                              <div key={p.profile_id} className="flex items-center justify-between">
                                <span
                                  className={`text-sm ${p.est_gagnant ? "font-semibold text-encre" : "text-encre"}`}
                                >
                                  {p.profile?.pseudo ?? "Joueur inconnu"}
                                </span>
                              </div>
                            ))}
                            {participants.length === 1 && (
                              <span className="font-mono text-[0.7rem] text-ardoise">
                                En attente d&apos;adversaire
                              </span>
                            )}
                          </div>
                        )}

                        {!verdict && m.statut === "litige" && (
                          <p className="mt-2 border-t border-trait pt-2 font-mono text-[0.68rem] text-sceau-texte uppercase">
                            Résultat non retrouvé automatiquement — décision manuelle requise
                          </p>
                        )}

                        {verdict && (
                          <div className="mt-2 flex items-center gap-2 border-t border-trait pt-2">
                            <Badge couleur={COULEUR_NIVEAU[verdict.niveau]}>{LABEL_NIVEAU[verdict.niveau]}</Badge>
                            {verdict.motif && (
                              <span className="text-[0.72rem] text-ardoise">{verdict.motif}</span>
                            )}
                          </div>
                        )}

                        {peutDecider && (
                          <form
                            action={enregistrerResultat}
                            className="mt-3 flex flex-col gap-2 border-t border-trait pt-3"
                          >
                            <input type="hidden" name="match_id" value={m.id} />
                            <input type="hidden" name="tournament_id" value={tournoi.id} />
                            <fieldset className="flex flex-col gap-2">
                              <legend className="font-mono text-[0.6rem] tracking-[0.12em] text-ardoise uppercase">
                                Déclarer le vainqueur —{" "}
                                {participants
                                  .map((p) => p.profile?.pseudo ?? "Joueur inconnu")
                                  .join(" vs ")}
                              </legend>
                              {participants.map((p) => (
                                <label
                                  key={p.profile_id}
                                  className="flex items-center gap-2 text-sm text-encre"
                                >
                                  <input
                                    type="radio"
                                    name="gagnant_id"
                                    value={p.profile_id}
                                    required
                                    className="accent-sceau"
                                  />
                                  {p.profile?.pseudo ?? "Joueur inconnu"}
                                </label>
                              ))}
                              <input
                                name="motif"
                                type="text"
                                required
                                aria-label={`Motif — ${participants
                                  .map((p) => p.profile?.pseudo ?? "Joueur inconnu")
                                  .join(" vs ")}`}
                                placeholder="Motif (obligatoire, affiché publiquement)"
                                className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
                              />
                            </fieldset>
                            <Bouton
                              aria-label={`Enregistrer le résultat — ${participants
                                .map((p) => p.profile?.pseudo ?? "Joueur inconnu")
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
      </Reveal>

      {litigesOuverts.length > 0 && (
        <Reveal delai={0.2}>
        <section className="mt-10">
          <SectionTitre>Litiges ouverts</SectionTitre>
          <ul className="mt-3 flex flex-col gap-3">
            {litigesOuverts.map((l) => (
              <li key={l.id} className={classeCarte("sceau")}>
                <p className="text-sm text-encre">
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
                      className="w-full rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
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
              </li>
            ))}
          </ul>
        </section>
        </Reveal>
      )}
      </div>
    </main>
  );
}
