import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerEquipesDesTournois, cleEquipe } from "@/lib/equipes-tournoi";
import {
  DELAI_PRONOSTIC_MINUTES,
  issuePronostic,
  LIBELLE_ISSUE,
  pointsPronostic,
  pronosticOuvert,
  type MatchPronostiquable,
} from "@/lib/pronostics";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";

// Pronostics gratuits (03/10/2026, audit N20) : matchs ouverts aux
// pronostics, classement des pronostiqueurs de la saison, pronostics du
// visiteur. Le vote se fait sur la page du tournoi (#pronostics).

export const metadata: Metadata = {
  title: "Pronostics — Najarena",
  description:
    "Pronostique les demi-finales et les finales des tournois League of Legends en cours. Aucune mise, aucun gain : un classement des pronostiqueurs, résultats lus chez Riot.",
  alternates: { canonical: "/lol/pronostics" },
};

// Hors du composant : l'heure courante ne se lit pas pendant le rendu.
function ouvertMaintenant(m: MatchPronostiquable): boolean {
  return pronosticOuvert(m, new Date());
}

export default async function PronosticsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const moi = userData.user?.id;

  const [{ data: matchsData }, { data: classement }, { data: mesPronostics }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, tour, position, statut, demarre_le, tournament:tournaments!inner(id, slug, nom, capacite, statut, nature, format), match_participants(profile_id, slot, pret_le, profile:profiles(pseudo))",
      )
      .eq("tournament.statut", "en_cours")
      .eq("tournament.nature", "tournoi")
      .in("statut", ["en_attente", "en_cours"])
      .order("demarre_le", { ascending: true, nullsFirst: false })
      .limit(200),
    supabase.rpc("classement_pronostics", { p_limite: 50 }),
    moi
      ? supabase
          .from("pronostics")
          .select(
            "gagnant_prevu, cree_le, match:matches(id, tour, tournament:tournaments(slug, nom, capacite, format, id), match_participants(profile_id, profile:profiles(pseudo)), match_verdicts(niveau, gagnant_id, est_definitif))",
          )
          .eq("profile_id", moi)
          .order("cree_le", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const ouverts = (matchsData ?? []).filter(
    (m) =>
      pointsPronostic(m.tour, m.tournament.capacite) > 0 &&
      ouvertMaintenant({
        statutTournoi: m.tournament.statut,
        statutMatch: m.statut,
        demarreLe: m.demarre_le,
        nbParticipants: m.match_participants.length,
        unJoueurPret: m.match_participants.some((p) => p.pret_le),
        aUnVerdict: false,
      }),
  );

  // En 5v5, le capitaine représente son équipe : on affiche l'équipe.
  const tournois5v5 = new Set<string>([
    ...ouverts.filter((m) => m.tournament.format === "5v5").map((m) => m.tournament.id),
    ...(mesPronostics ?? []).flatMap((p) => (p.match?.tournament?.format === "5v5" ? [p.match.tournament.id] : [])),
  ]);
  const equipes = await chargerEquipesDesTournois(supabase, [...tournois5v5]);
  const nom = (tournamentId: string, profileId: string, pseudo: string | null | undefined) =>
    equipes.get(cleEquipe(tournamentId, profileId))?.libelle ?? pseudo ?? "Joueur";

  const lienPronostics = (slug: string) => `/lol/tournois/${slug}#pronostics`;
  const LIEN =
    "inline-flex min-h-11 items-center text-mini font-semibold text-accent uppercase underline underline-offset-3";

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition>
          <Link
            href="/lol"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← League of Legends
          </Link>
          <h1 className="mt-6 font-titre text-section font-black tracking-[1px] uppercase">Pronostics</h1>
          <p className="mt-3 max-w-2xl text-courant text-text-2">
            Qui gagne les demi-finales et la finale ? Une demi-finale juste vaut 1 point, une finale 2 points, comptés
            seulement sur un résultat lu chez Riot (un forfait ou une décision manuelle annule le pronostic).{" "}
            <strong className="text-text">Aucune mise, aucun gain</strong> : un classement des pronostiqueurs par
            saison, rien d&apos;autre.
          </p>
        </Apparition>

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">À pronostiquer maintenant</LibelleSection>
          {ouverts.length === 0 ? (
            <Panneau className="p-6">
              <p className="text-sm text-muted">
                Aucun match ouvert aux pronostics pour l&apos;instant : ils ouvrent dès que les adversaires d&apos;une
                demi-finale ou d&apos;une finale sont connus, et ferment dès qu&apos;un joueur se déclare prêt (
                {DELAI_PRONOSTIC_MINUTES} minutes après l&apos;ouverture du match au plus tard).{" "}
                <Link href="/lol/tournois" className="text-accent underline underline-offset-3">
                  Voir les tournois
                </Link>
              </p>
            </Panneau>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {ouverts.map((m) => {
                const duo = [...m.match_participants].sort((a, b) => a.slot - b.slot);
                return (
                  <li key={m.id}>
                    <Panneau className="flex h-full flex-col gap-2 p-5">
                      <p className="text-mini text-muted uppercase">
                        {m.tournament.nom} ·{" "}
                        {pointsPronostic(m.tour, m.tournament.capacite) === 2 ? "Finale" : "Demi-finale"}
                      </p>
                      <p className="font-titre text-xl font-extrabold uppercase">
                        {duo.map((p) => nom(m.tournament.id, p.profile_id, p.profile?.pseudo)).join(" contre ")}
                      </p>
                      <Link href={lienPronostics(m.tournament.slug)} className={LIEN}>
                        Pronostiquer
                      </Link>
                    </Panneau>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <LibelleSection as="h2">Classement des pronostiqueurs — saison en cours</LibelleSection>
          {(classement ?? []).length === 0 ? (
            <Panneau className="p-6">
              <p className="text-sm text-muted">
                Pas encore de pronostic tranché cette saison : le classement se remplit à mesure que les résultats sont
                lus chez Riot.
              </p>
            </Panneau>
          ) : (
            <Tableau legende="Classement des pronostiqueurs de la saison en cours">
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">Pronostiqueur</th>
                  <th scope="col">Points</th>
                  <th scope="col">Justes</th>
                </tr>
              </thead>
              <tbody>
                {(classement ?? []).map((l, i) => (
                  <tr key={l.profile_id}>
                    <td className="tabular-nums">#{i + 1}</td>
                    <td>
                      <Link href={`/joueur/${l.slug}`} className="hover:text-accent">
                        {l.pseudo}
                      </Link>
                    </td>
                    <td className="tabular-nums">{l.points}</td>
                    <td className="tabular-nums">
                      {l.justes} / {l.comptes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tableau>
          )}
        </section>

        {moi && (
          <section className="flex flex-col gap-4">
            <LibelleSection as="h2">Tes pronostics</LibelleSection>
            {(mesPronostics ?? []).length === 0 ? (
              <p className="text-sm text-muted">Tu n&apos;as encore rien pronostiqué.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(mesPronostics ?? []).flatMap((p) => {
                  const match = p.match;
                  const tournoi = match?.tournament;
                  if (!match || !tournoi) return [];
                  const verdict = match.match_verdicts.find((v) => v.est_definitif);
                  const issue = issuePronostic(
                    p.gagnant_prevu,
                    verdict ? { niveau: verdict.niveau, gagnantId: verdict.gagnant_id } : null,
                  );
                  const choisi = match.match_participants.find((x) => x.profile_id === p.gagnant_prevu);
                  return [
                    <li key={match.id}>
                      <Panneau className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <span className="text-sm">
                          <Link href={lienPronostics(tournoi.slug)} className="hover:text-accent">
                            {tournoi.nom}
                          </Link>{" "}
                          <span className="text-muted">
                            · {pointsPronostic(match.tour, tournoi.capacite) === 2 ? "finale" : "demi-finale"} · ton
                            choix : {nom(tournoi.id, p.gagnant_prevu, choisi?.profile?.pseudo)}
                          </span>
                        </span>
                        <span
                          className={`text-mini font-semibold uppercase ${issue === "juste" ? "text-accent" : issue === "faux" ? "text-danger" : "text-muted"}`}
                        >
                          {LIBELLE_ISSUE[issue]}
                        </span>
                      </Panneau>
                    </li>,
                  ];
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
