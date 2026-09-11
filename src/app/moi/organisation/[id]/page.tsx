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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/moi"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← Mon compte
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[0.64rem] tracking-[0.22em] text-ardoise uppercase">
            Cockpit organisateur
          </span>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
            {tournoi.nom}
          </h1>
        </div>
        <span
          className={`shrink-0 font-mono text-[0.62rem] tracking-[0.1em] uppercase ${
            COULEUR_STATUT[tournoi.statut as keyof typeof COULEUR_STATUT] ?? "text-ardoise"
          }`}
        >
          {LABEL_STATUT[tournoi.statut as keyof typeof LABEL_STATUT] ?? tournoi.statut}
        </span>
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
        <p className="mt-6 rounded-[3px] border border-sceau/30 bg-sceau/10 p-3 text-sm text-sceau">
          {erreur}
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Inscrits et check-in
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
                        className="font-mono text-[0.62rem] text-sceau underline underline-offset-3"
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

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">Bracket</h2>

        {!bracketGenere ? (
          <div className="mt-3 rounded-[3px] border border-trait bg-carte p-4">
            <p className="text-sm text-ardoise">
              {nbConfirmes} joueur{nbConfirmes === 1 ? "" : "s"} confirmé
              {nbConfirmes === 1 ? "" : "s"}. Le tirage se fait aléatoirement
              entre les joueurs confirmés au moment de la génération.
            </p>
            <form action={genererBracket} className="mt-3">
              <input type="hidden" name="tournament_id" value={tournoi.id} />
              <button
                type="submit"
                disabled={nbConfirmes < 2}
                className="rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Générer le bracket
              </button>
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

                    return (
                      <li key={m.id} className="rounded-[3px] border border-trait bg-carte p-4">
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
                          <p className="mt-2 border-t border-trait pt-2 font-mono text-[0.68rem] text-sceau uppercase">
                            Résultat non retrouvé automatiquement — décision manuelle requise
                          </p>
                        )}

                        {verdict && (
                          <div className="mt-2 flex items-center gap-2 border-t border-trait pt-2">
                            <span
                              className={`font-mono text-[0.58rem] tracking-[0.1em] uppercase ${COULEUR_NIVEAU[verdict.niveau]}`}
                            >
                              {LABEL_NIVEAU[verdict.niveau]}
                            </span>
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
                            </fieldset>
                            <input
                              name="motif"
                              type="text"
                              required
                              placeholder="Motif (obligatoire, affiché publiquement)"
                              className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
                            />
                            <button
                              type="submit"
                              className="self-start rounded-[3px] bg-sceau px-3 py-1.5 text-[0.8rem] font-semibold text-papier transition hover:brightness-110"
                            >
                              Enregistrer le résultat
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

      {litigesOuverts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
            Litiges ouverts
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {litigesOuverts.map((l) => (
              <li key={l.id} className="rounded-[3px] border border-sceau/30 bg-sceau/10 p-4">
                <p className="text-sm text-encre">
                  Ouvert par{" "}
                  <span className="font-medium">{l.ouvert_par?.pseudo ?? "un joueur"}</span> :{" "}
                  {l.motif}
                </p>
                <form action={resoudreLitige} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="dispute_id" value={l.id} />
                  <input type="hidden" name="tournament_id" value={tournoi.id} />
                  <input
                    name="resolution"
                    type="text"
                    required
                    placeholder="Résolution (obligatoire)"
                    className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
                  />
                  <button
                    type="submit"
                    className="self-start rounded-[3px] bg-sceau px-3 py-1.5 text-[0.8rem] font-semibold text-papier transition hover:brightness-110"
                  >
                    Résoudre
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
