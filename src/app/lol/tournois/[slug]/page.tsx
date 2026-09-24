import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { sInscrireATournoi } from "@/lib/inscription-actions";
import { ouvrirLitige } from "@/lib/litige-actions";
import { SuiviTempsReel } from "@/components/SuiviTempsReel";
import { progressionPalier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import {
  estVisiblePubliquement,
  formaterDate,
  type StatutPublic,
} from "@/lib/tournois";
import { chargerComplementsTournoi } from "@/lib/tournoi-vitrine";
import BoutonLien from "@/components/design/BoutonLien";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import { CaseMatch, ColonnesBracket, type EtatMatch } from "@/components/tournoi/Bracket";
import {
  Deroulement,
  EnTeteTournoi,
  EssentielReglement,
  LegendeBracket,
  StatutTournoi,
  type EtatEtape,
  type InfoTournoi,
} from "@/components/tournoi/BlocsTournoi";
import OngletsTournoi from "@/components/tournoi/OngletsTournoi";

// Refonte « Venin » du 24/09/2026 (design-system/najarena/pages/tournoi.md,
// maquette najarena-design/maquettes/tournoi.dc.html) : seule l'apparence a
// changé. chargerTournoi et les conditions d'inscription / de litige sont
// repris tels quels ; les informations ajoutées (type de bracket, niveau,
// prise en compte au classement) viennent de lib/tournoi-vitrine.ts.
// Pas de bloc « Récompenses » : aucune récompense n'existe en base (cash
// prizes = phase 4) — remplacé par « En jeu : points de classement ».

// "Non classé" n'est pas un palier réel (table tiers) : jamais de rating
// affiché tant que le RD n'est pas descendu sous le seuil de classement
// (CLAUDE.md §4) — voir joueur/[pseudo] pour le même traitement.
const COULEUR_NON_CLASSE = "var(--color-ardoise)";

interface TournoiPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

async function chargerTournoi(slug: string) {
  const supabase = await createClient();

  const { data: tournoi, error: erreurTournoi } = await supabase
    .from("tournaments")
    .select(
      "id, slug, nom, format, capacite, region, statut, debute_le, checkin_ouvre_le, best_of, organisateur_id, game_id",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (erreurTournoi) {
    return { statut: "erreur" as const };
  }

  if (!tournoi || !estVisiblePubliquement(tournoi.statut)) {
    return { statut: "introuvable" as const };
  }

  // Étage 1 : ces cinq requêtes ne dépendent que du tournoi déjà chargé,
  // jamais les unes des autres — lancées en parallèle plutôt qu'en série
  // (correctif du 13/09/2026, même logique que sur l'accueil).
  const [
    { data: organisateur },
    { data: userData },
    { data: inscriptionsData },
    { data: paliersData },
    { data: matchsData },
  ] = await Promise.all([
    supabase.from("profiles").select("pseudo, slug").eq("id", tournoi.organisateur_id).maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("registrations")
      .select("id, statut, seed, profile_id, profile:profiles(pseudo, slug)")
      .eq("tournament_id", tournoi.id)
      .order("seed", { ascending: true, nullsFirst: false }),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", tournoi.game_id),
    supabase
      .from("matches")
      .select(
        "id, tour, position, statut, match_participants(profile_id, slot, score, est_gagnant, profile:profiles(pseudo, slug))",
      )
      .eq("tournament_id", tournoi.id)
      .order("tour", { ascending: true })
      .order("position", { ascending: true }),
  ]);

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const profileIds = (inscriptionsData ?? []).map((i) => i.profile_id);
  const matchIds = (matchsData ?? []).map((m) => m.id);

  // Étage 2 : dépendent des résultats de l'étage 1 (profileIds, matchIds,
  // userData) mais pas les unes des autres — parallélisées de même.
  const [{ data: ratingsData }, { data: verdictsData }, { data: litigesData }] = await Promise.all([
    profileIds.length > 0
      ? supabase
          .from("ratings")
          .select("profile_id, rating, est_classe")
          .eq("game_id", tournoi.game_id)
          .in("profile_id", profileIds)
      : Promise.resolve({ data: [] }),
    matchIds.length > 0
      ? supabase
          .from("match_verdicts")
          .select("match_id, niveau, motif, gagnant_id")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : Promise.resolve({ data: [] }),
    matchIds.length > 0 && userData.user
      ? supabase.from("disputes").select("match_id, ouvert_par, resolution").in("match_id", matchIds)
      : Promise.resolve({ data: [] }),
  ]);

  const ratingParProfile = new Map((ratingsData ?? []).map((r) => [r.profile_id, r]));
  const verdictParMatch = new Map((verdictsData ?? []).map((v) => [v.match_id, v]));
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
    paliers,
    ratingParProfile,
  };
}

function crestJoueur(
  profileId: string,
  ratingParProfile: Map<string, { rating: number; est_classe: boolean | null }>,
  paliers: { nom: string; ratingMin: number }[],
) {
  const rating = ratingParProfile.get(profileId);
  if (!rating || !rating.est_classe) {
    return { nom: "Non classé", couleur: COULEUR_NON_CLASSE, progression: 0 };
  }
  const { palier, progression } = progressionPalier(rating.rating, paliers);
  if (!palier) return { nom: "Non classé", couleur: COULEUR_NON_CLASSE, progression: 0 };
  return {
    nom: palier.nom,
    couleur: COULEUR_PALIER[palier.nom.toLowerCase()] ?? COULEUR_NON_CLASSE,
    progression,
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
      <main className="flex-1 bg-bg px-gouttiere pt-32 pb-24 font-texte text-text">
        <Panneau className="mx-auto max-w-contenu px-8 py-10">
          <p className="text-danger">Impossible de charger ce tournoi pour l&apos;instant. Réessaie dans un instant.</p>
        </Panneau>
      </main>
    );
  }

  const { tournoi, organisateur, inscriptions, matchs, verdictParMatch, litigeParMatch, utilisateur, paliers, ratingParProfile } =
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

  const complements = await chargerComplementsTournoi(tournoi.id);
  // Nom des colonnes : tous les tours sont créés dès la génération du
  // bracket (lib/organisation-actions.ts), le dernier est donc la finale.
  const libelleTour = (index: number) => {
    const reste = toursOrdonnes.length - index;
    if (reste === 1) return "Finale";
    if (reste === 2) return "Demi-finales";
    if (reste === 3) return "Quarts";
    if (reste === 4) return "Huitièmes";
    return `Tour ${toursOrdonnes[index]}`;
  };

  const etapes: { titre: string; quand: string; etat: EtatEtape }[] =
    statut === "annule"
      ? [{ titre: "Tournoi annulé", quand: formaterDate(tournoi.debute_le), etat: "fait" }]
      : [
          {
            titre: "Inscriptions",
            quand: statut === "ouvert" ? `Jusqu'au ${formaterDate(tournoi.checkin_ouvre_le)}` : "Terminées",
            etat: statut === "ouvert" ? "maintenant" : "fait",
          },
          {
            titre: "Check-in",
            quand:
              statut === "checkin" ? "En cours" : statut === "ouvert" ? formaterDate(tournoi.checkin_ouvre_le) : "Terminé",
            etat: statut === "checkin" ? "maintenant" : statut === "ouvert" ? "a_venir" : "fait",
          },
          ...(toursOrdonnes.length === 0
            ? [
                {
                  titre: "Début des matchs",
                  quand: formaterDate(tournoi.debute_le),
                  etat: (statut === "termine" ? "fait" : "a_venir") as EtatEtape,
                },
              ]
            : toursOrdonnes.map((tour, index) => {
                const matchsDuTour = rounds.get(tour) ?? [];
                const joues = matchsDuTour.filter((m) => verdictParMatch.has(m.id)).length;
                const etat: EtatEtape =
                  statut === "termine" || (matchsDuTour.length > 0 && joues === matchsDuTour.length)
                    ? "fait"
                    : joues > 0 || matchsDuTour.some((m) => m.statut === "en_cours")
                      ? "maintenant"
                      : "a_venir";
                return {
                  titre: libelleTour(index),
                  quand:
                    etat === "fait"
                      ? "Terminé"
                      : etat === "maintenant"
                        ? "En cours"
                        : index === 0
                          ? formaterDate(tournoi.debute_le)
                          : "Ensuite",
                  etat,
                };
              })),
        ];

  const infos: InfoTournoi[] = [
    {
      libelle: "En jeu",
      valeur: complements.comptePourClassement ? "Points de classement" : "Match amical",
      grand: true,
      accent: complements.comptePourClassement,
    },
    { libelle: "Inscrits", valeur: `${inscriptions.length}/${tournoi.capacite}`, grand: true, accent: false },
    { libelle: "Format", valeur: `${tournoi.format} · BO${tournoi.best_of}`, grand: false, accent: false },
    { libelle: "Niveau", valeur: complements.niveau, grand: false, accent: false },
  ];

  const CHAMP =
    "w-full rounded-bouton border border-line-strong bg-bg px-3 py-2.5 font-texte text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <main className="bg-bg font-texte text-text">
      {statut !== "termine" && statut !== "annule" && (
        <SuiviTempsReel
          canal={`tournoi-${tournoi.id}`}
          tables={["matches", "match_participants", "match_verdicts", "registrations", "disputes"]}
        />
      )}

      {/* ================= EN-TÊTE D'AFFICHE ================= */}
      <EnTeteTournoi
        nom={tournoi.nom}
        etiquettes={
          <>
            <StatutTournoi statut={statut} />
            <span className="text-text-2">
              LoL · {tournoi.format}
              {complements.typeBracket ? ` · ${complements.typeBracket}` : ""}
            </span>
          </>
        }
        details={
          <>
            <span className="tabular-nums">{formaterDate(tournoi.debute_le)}</span> · {tournoi.region}
            {organisateur && (
              <>
                {" "}
                · Organisé par{" "}
                <Link
                  href={`/joueur/${organisateur.slug}`}
                  className="text-text underline decoration-[rgba(245,245,244,0.3)] underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {organisateur.pseudo}
                </Link>
              </>
            )}{" "}
            · Résultats vérifiés automatiquement
          </>
        }
        infos={infos}
        action={
          <>
            {erreur && (
              <p role="alert" className="rounded-bouton border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                {erreur}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-bouton border border-accent/40 bg-accent/8 px-3 py-2.5 text-sm text-accent">
                {message}
              </p>
            )}

            {estOrganisateur ? (
              <BoutonLien href={`/moi/organisation/${tournoi.id}`} className="w-full">
                Gérer ce tournoi
              </BoutonLien>
            ) : inscriptionActuelle ? (
              <p className="flex items-center justify-between gap-3 border-t border-line pt-[18px] text-[13px]">
                <span className="text-muted">Ton inscription</span>
                <span className="font-bold text-accent uppercase">Inscrit · {inscriptionActuelle.statut}</span>
              </p>
            ) : statut === "ouvert" ? (
              utilisateur ? (
                <form action={sInscrireATournoi}>
                  <input type="hidden" name="tournament_id" value={tournoi.id} />
                  <input type="hidden" name="slug" value={tournoi.slug} />
                  <BoutonEnvoi libelleEnCours="Inscription…" className="w-full">
                    S&apos;inscrire
                  </BoutonEnvoi>
                </form>
              ) : (
                <BoutonLien href="/connexion" className="w-full">
                  Se connecter pour s&apos;inscrire
                </BoutonLien>
              )
            ) : null}
          </>
        }
      />

      <OngletsTournoi />

      {/* ================= BRACKET ================= */}
      <section id="bracket" className="scroll-mt-28 px-gouttiere pt-12">
        <div className="mx-auto flex max-w-contenu flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LibelleSection as="h2">Bracket</LibelleSection>
            <LegendeBracket />
          </div>

          {toursOrdonnes.length === 0 ? (
            <Panneau reperes className="px-8 py-10">
              <p className="text-muted">Le bracket n&apos;a pas encore été généré.</p>
            </Panneau>
          ) : (
            <ColonnesBracket
              legende={`Bracket du tournoi ${tournoi.nom}`}
              tours={toursOrdonnes.map((tour, indexTour) => ({
                numero: tour,
                libelle: libelleTour(indexTour),
                matchs: rounds.get(tour)!.map((m) => {
                  const verdict = verdictParMatch.get(m.id);
                  const litige = litigeParMatch.get(m.id);
                  const estParticipantDuMatch = utilisateur
                    ? m.match_participants.some((p) => p.profile_id === utilisateur.id)
                    : false;
                  const peutSignalerLitige = estParticipantDuMatch && verdict && !litige;
                  const etat: EtatMatch =
                    litige && !litige.resolution
                      ? "litige"
                      : !verdict && m.statut === "litige"
                        ? "attente"
                        : verdict
                          ? "verdict"
                          : m.statut === "en_cours"
                            ? "direct"
                            : "a_venir";
                  const libelleMatch = m.match_participants
                    .map((p) => p.profile?.pseudo ?? "Joueur inconnu")
                    .join(" vs ");
                  return {
                    id: m.id,
                    joue: Boolean(verdict),
                    atteint: m.match_participants.length > 0,
                    contenu: (
                      <CaseMatch
                        participants={[...m.match_participants]
                          .sort((a, b) => a.slot - b.slot)
                          .map((p) => ({
                            cle: p.profile_id,
                            pseudo: p.profile?.pseudo ?? null,
                            slug: p.profile?.slug ?? null,
                            score: p.score,
                            estGagnant: p.est_gagnant,
                          }))}
                        etat={etat}
                        niveau={verdict?.niveau}
                        motif={verdict?.motif}
                        monMatch={estParticipantDuMatch}
                      >
                        {!verdict && m.statut === "litige" && (
                          <p className="text-xs text-danger">
                            Résultat non retrouvé automatiquement — en attente de l&apos;organisateur.
                          </p>
                        )}
                        {litige && (
                          <p className={`text-xs ${litige.resolution ? "text-muted" : "text-danger"}`}>
                            {litige.resolution ? "Litige résolu." : "Litige signalé — en attente de l'organisateur."}
                          </p>
                        )}
                        {peutSignalerLitige && (
                          <details>
                            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-mini font-semibold text-danger uppercase [&::-webkit-details-marker]:hidden">
                              Signaler un litige
                            </summary>
                            <form action={ouvrirLitige} className="flex flex-col gap-2">
                              <input type="hidden" name="match_id" value={m.id} />
                              <input type="hidden" name="slug" value={tournoi.slug} />
                              <label className="flex flex-col gap-1.5">
                                <span className="text-mini text-muted uppercase">
                                  Motif<span className="sr-only"> du litige — {libelleMatch}</span>
                                </span>
                                <input
                                  name="motif"
                                  type="text"
                                  required
                                  placeholder="Ce qui ne va pas dans ce résultat"
                                  className={CHAMP}
                                />
                              </label>
                              <BoutonEnvoi
                                variante="contour"
                                libelleEnCours="Envoi…"
                                aria-label={`Signaler un litige — ${libelleMatch}`}
                                className="self-start"
                              >
                                Envoyer
                              </BoutonEnvoi>
                            </form>
                          </details>
                        )}
                      </CaseMatch>
                    ),
                  };
                }),
              }))}
            />
          )}
        </div>
      </section>

      {/* ================= INSCRITS ================= */}
      <section id="inscrits" className="scroll-mt-28 px-gouttiere pt-section-outil">
        <div className="mx-auto flex max-w-contenu flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LibelleSection as="h2">Inscrits</LibelleSection>
            <span className="text-xs text-muted tabular-nums">
              {inscriptions.length} / {tournoi.capacite} places
            </span>
          </div>
          {inscriptions.length === 0 ? (
            <Panneau reperes className="px-8 py-10">
              <p className="text-muted">Aucune inscription pour l&apos;instant.</p>
            </Panneau>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inscriptions.map((i) => {
                const crest = crestJoueur(i.profile_id, ratingParProfile, paliers);
                const moi = utilisateur?.id === i.profile_id;
                return (
                  <li
                    key={i.id}
                    className={`panneau flex items-center justify-between gap-3 px-4 py-3 ${moi ? "border-l-[3px] border-l-accent!" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <AvatarJoueur pseudo={i.profile?.pseudo ?? "?"} taille={34} />
                      <span className="flex min-w-0 flex-col">
                        {i.profile ? (
                          <Link
                            href={`/joueur/${i.profile.slug}`}
                            className="truncate font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            {i.profile.pseudo}
                          </Link>
                        ) : (
                          <span className="font-semibold">Joueur inconnu</span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full"
                            style={{ background: crest.nom === "Non classé" ? "var(--color-muted)" : crest.couleur }}
                          />
                          {crest.nom}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-mini text-muted uppercase tabular-nums">
                      {i.seed ? `Seed ${i.seed}` : i.statut}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ================= DÉROULEMENT + RÈGLEMENT ================= */}
      <section className="px-gouttiere pt-section-outil pb-24">
        <div className="mx-auto grid max-w-contenu gap-8 md:grid-cols-2">
          <Deroulement etapes={etapes} />
          <EssentielReglement organisateur={organisateur?.pseudo} />
        </div>
      </section>
    </main>
  );
}

