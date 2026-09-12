import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { sInscrireATournoi } from "@/lib/inscription-actions";
import { ouvrirLitige } from "@/lib/litige-actions";
import { SuiviTempsReel } from "@/components/SuiviTempsReel";
import {
  LABEL_STATUT,
  COULEUR_STATUT,
  LABEL_NIVEAU,
  COULEUR_NIVEAU,
  estVisiblePubliquement,
  formaterDate,
  type StatutPublic,
} from "@/lib/tournois";

interface TournoiPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

async function chargerTournoi(slug: string) {
  const supabase = await createClient();

  const { data: tournoi, error: erreurTournoi } = await supabase
    .from("tournaments")
    .select(
      "id, slug, nom, format, capacite, region, statut, debute_le, checkin_ouvre_le, best_of, organisateur_id",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (erreurTournoi) {
    return { statut: "erreur" as const };
  }

  if (!tournoi || !estVisiblePubliquement(tournoi.statut)) {
    return { statut: "introuvable" as const };
  }

  const { data: organisateur } = await supabase
    .from("profiles")
    .select("pseudo, slug")
    .eq("id", tournoi.organisateur_id)
    .maybeSingle();

  const { data: userData } = await supabase.auth.getUser();

  const { data: inscriptionsData } = await supabase
    .from("registrations")
    .select("id, statut, seed, profile_id, profile:profiles(pseudo, slug)")
    .eq("tournament_id", tournoi.id)
    .order("seed", { ascending: true, nullsFirst: false });

  const { data: matchsData } = await supabase
    .from("matches")
    .select(
      "id, tour, position, statut, match_participants(profile_id, slot, score, est_gagnant, profile:profiles(pseudo, slug))",
    )
    .eq("tournament_id", tournoi.id)
    .order("tour", { ascending: true })
    .order("position", { ascending: true });

  const matchIds = (matchsData ?? []).map((m) => m.id);

  const { data: verdictsData } =
    matchIds.length > 0
      ? await supabase
          .from("match_verdicts")
          .select("match_id, niveau, motif, gagnant_id")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : { data: [] };

  const verdictParMatch = new Map((verdictsData ?? []).map((v) => [v.match_id, v]));

  const { data: litigesData } =
    matchIds.length > 0 && userData.user
      ? await supabase
          .from("disputes")
          .select("match_id, ouvert_par, resolution")
          .in("match_id", matchIds)
      : { data: [] };
  const litigeParMatch = new Map((litigesData ?? []).map((l) => [l.match_id, l]));

  return {
    statut: "ok" as const,
    tournoi,
    organisateur,
    inscriptions: inscriptionsData ?? [],
    matchs: matchsData ?? [],
    verdictParMatch,
    litigeParMatch,
    utilisateur: userData.user,
  };
}

export async function generateMetadata({
  params,
}: TournoiPageProps): Promise<Metadata> {
  const { slug } = await params;
  const donnees = await chargerTournoi(slug);

  if (donnees.statut !== "ok") {
    return { title: "Tournoi introuvable — Najarena" };
  }

  return {
    title: `${donnees.tournoi.nom} — Najarena`,
    description: `Tournoi League of Legends ${donnees.tournoi.format}, ${donnees.tournoi.capacite} joueurs, région ${donnees.tournoi.region}. Résultats lus dans la donnée officielle Riot.`,
  };
}

export default async function TournoiPage({ params, searchParams }: TournoiPageProps) {
  const { slug } = await params;
  const { erreur, message } = await searchParams;
  const donnees = await chargerTournoi(slug);

  if (donnees.statut === "introuvable") {
    notFound();
  }

  if (donnees.statut === "erreur") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="rounded-[3px] border border-sceau/30 bg-sceau/10 p-6 text-sm text-sceau">
          Impossible de charger ce tournoi pour l&apos;instant. Réessaie dans
          un instant.
        </p>
      </main>
    );
  }

  const { tournoi, organisateur, inscriptions, matchs, verdictParMatch, litigeParMatch, utilisateur } =
    donnees;
  const statut = tournoi.statut as StatutPublic;
  const estOrganisateur = utilisateur?.id === tournoi.organisateur_id;
  const inscriptionActuelle = utilisateur
    ? inscriptions.find((i) => i.profile_id === utilisateur.id)
    : undefined;

  const rounds = new Map<number, typeof matchs>();
  for (const m of matchs) {
    const liste = rounds.get(m.tour) ?? [];
    liste.push(m);
    rounds.set(m.tour, liste);
  }
  const toursOrdonnes = Array.from(rounds.keys()).sort((a, b) => a - b);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {statut !== "termine" && statut !== "annule" && (
        <SuiviTempsReel
          canal={`tournoi-${tournoi.id}`}
          tables={["matches", "match_participants", "match_verdicts", "registrations", "disputes"]}
        />
      )}
      <Link
        href="/lol/tournois"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← Tournois
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[0.64rem] tracking-[0.22em] text-ardoise uppercase">
            League of Legends
          </span>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
            {tournoi.nom}
          </h1>
        </div>
        <span
          className={`shrink-0 font-mono text-[0.62rem] tracking-[0.1em] uppercase ${COULEUR_STATUT[statut]}`}
        >
          {LABEL_STATUT[statut]}
        </span>
      </div>

      <div className="mt-3 font-mono text-[0.78rem] text-ardoise">
        {tournoi.format} · {tournoi.capacite} joueurs · {tournoi.region} ·{" "}
        {formaterDate(tournoi.debute_le)}
        {tournoi.best_of > 1 ? ` · BO${tournoi.best_of}` : ""}
      </div>

      {organisateur && (
        <div className="mt-1 font-mono text-[0.72rem] text-ardoise">
          Organisé par{" "}
          <Link href={`/joueur/${organisateur.slug}`} className="text-encre hover:underline">
            {organisateur.pseudo}
          </Link>
        </div>
      )}

      {erreur && (
        <p className="mt-4 rounded-[3px] border border-sceau/30 bg-sceau/10 p-3 text-sm text-sceau">
          {erreur}
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-[3px] border border-atteste/30 bg-atteste/10 p-3 text-sm text-atteste">
          {message}
        </p>
      )}

      <div className="mt-4">
        {estOrganisateur ? (
          <Link
            href={`/moi/organisation/${tournoi.id}`}
            className="inline-block rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
          >
            Gérer ce tournoi
          </Link>
        ) : inscriptionActuelle ? (
          <span className="font-mono text-[0.72rem] text-atteste uppercase">
            Tu es inscrit — statut : {inscriptionActuelle.statut}
          </span>
        ) : statut === "ouvert" ? (
          utilisateur ? (
            <form action={sInscrireATournoi}>
              <input type="hidden" name="tournament_id" value={tournoi.id} />
              <input type="hidden" name="slug" value={tournoi.slug} />
              <button
                type="submit"
                className="rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
              >
                S&apos;inscrire
              </button>
            </form>
          ) : (
            <Link
              href="/connexion"
              className="font-mono text-[0.72rem] text-sceau underline underline-offset-3"
            >
              Se connecter pour s&apos;inscrire
            </Link>
          )
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Inscrits
        </h2>
        {inscriptions.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Aucune inscription pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {inscriptions.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between rounded-[3px] border border-trait bg-carte px-4 py-2"
              >
                <span className="text-sm font-medium text-encre">
                  {i.profile ? (
                    <Link href={`/joueur/${i.profile.slug}`} className="hover:underline">
                      {i.profile.pseudo}
                    </Link>
                  ) : (
                    "Joueur inconnu"
                  )}
                </span>
                <span className="font-mono text-[0.66rem] text-ardoise uppercase">
                  {i.seed ? `Seed ${i.seed}` : i.statut}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Bracket
        </h2>
        {toursOrdonnes.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Le bracket n&apos;a pas encore été généré.
          </p>
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
                    const litige = litigeParMatch.get(m.id);
                    const estParticipantDuMatch = utilisateur
                      ? m.match_participants.some((p) => p.profile_id === utilisateur.id)
                      : false;
                    const peutSignalerLitige = estParticipantDuMatch && verdict && !litige;
                    return (
                      <li
                        key={m.id}
                        className="rounded-[3px] border border-trait bg-carte p-4"
                      >
                        {m.match_participants.length === 0 ? (
                          <span className="text-sm text-ardoise">
                            Match à venir
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {m.match_participants
                              .sort((a, b) => a.slot - b.slot)
                              .map((p) => (
                                <div
                                  key={p.profile_id}
                                  className="flex items-center justify-between"
                                >
                                  <span
                                    className={`text-sm ${p.est_gagnant ? "font-semibold text-encre" : "text-encre"}`}
                                  >
                                    {p.profile ? (
                                      <Link
                                        href={`/joueur/${p.profile.slug}`}
                                        className="hover:underline"
                                      >
                                        {p.profile.pseudo}
                                      </Link>
                                    ) : (
                                      "Joueur inconnu"
                                    )}
                                  </span>
                                  <span className="font-mono text-sm text-ardoise">
                                    {p.score}
                                  </span>
                                </div>
                              ))}
                            {m.match_participants.length === 1 && (
                              <span className="font-mono text-[0.7rem] text-ardoise">
                                En attente d&apos;adversaire
                              </span>
                            )}
                          </div>
                        )}

                        {!verdict && m.statut === "litige" && (
                          <p className="mt-2 border-t border-trait pt-2 font-mono text-[0.68rem] text-sceau uppercase">
                            Résultat non retrouvé automatiquement — en attente de l&apos;organisateur
                          </p>
                        )}

                        {verdict && (
                          <div className="mt-2 flex items-center gap-2 border-t border-trait pt-2">
                            <span
                              className={`font-mono text-[0.58rem] tracking-[0.1em] uppercase ${COULEUR_NIVEAU[verdict.niveau]}`}
                            >
                              {LABEL_NIVEAU[verdict.niveau]}
                            </span>
                            {verdict.niveau === "manuel" && verdict.motif && (
                              <span className="text-[0.72rem] text-ardoise">
                                {verdict.motif}
                              </span>
                            )}
                          </div>
                        )}

                        {litige && (
                          <p className="mt-2 border-t border-trait pt-2 font-mono text-[0.68rem] text-sceau uppercase">
                            {litige.resolution ? "Litige résolu" : "Litige signalé — en attente de l'organisateur"}
                          </p>
                        )}

                        {peutSignalerLitige && (
                          <form
                            action={ouvrirLitige}
                            className="mt-3 flex flex-col gap-2 border-t border-trait pt-3"
                          >
                            <input type="hidden" name="match_id" value={m.id} />
                            <input type="hidden" name="slug" value={tournoi.slug} />
                            <label>
                              <span className="sr-only">
                                Motif du litige —{" "}
                                {m.match_participants
                                  .map((p) => p.profile?.pseudo ?? "Joueur inconnu")
                                  .join(" vs ")}
                              </span>
                              <input
                                name="motif"
                                type="text"
                                required
                                placeholder="Signaler un litige sur ce résultat (motif obligatoire)"
                                className="w-full rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
                              />
                            </label>
                            <button
                              type="submit"
                              aria-label={`Signaler un litige — ${m.match_participants
                                .map((p) => p.profile?.pseudo ?? "Joueur inconnu")
                                .join(" vs ")}`}
                              className="self-start font-mono text-[0.66rem] text-sceau underline underline-offset-3"
                            >
                              Signaler un litige
                            </button>
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
    </main>
  );
}
