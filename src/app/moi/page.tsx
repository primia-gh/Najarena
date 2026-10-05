import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { cashPrizesActifs } from "@/lib/dotations";
import { seDeconnecter } from "@/lib/auth-actions";
import { mettreAJourRolePrefere } from "@/lib/riot-actions";
import { ROLES, LABEL_ROLE } from "@/lib/roles";
import { chargerOffre } from "@/lib/offres";
import { estStatutPublic, formaterDate, grouperTournois } from "@/lib/tournois";
import { arrondir, trouverPalier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { classeChamp } from "@/lib/design";
import { accepterInvitation, refuserInvitation } from "@/lib/equipe-actions";
import PushOptIn from "@/components/PushOptIn";
import SectionTitre from "@/components/ui/SectionTitre";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import { BadgeVerifie } from "@/components/design/Badges";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import LigneTournoiCompacte from "@/components/tournoi/LigneTournoiCompacte";
import { estPseudoAutomatique } from "@/lib/pseudo";
import { ouvrirPortailAbonnement } from "@/lib/stripe-actions";
import { chargerMesDefis } from "@/lib/defis-serveur";
import SectionDefis from "@/components/defis/SectionDefis";

export const metadata: Metadata = {
  title: "Mon compte — Najarena",
  robots: { index: false, follow: false },
};

interface MoiPageProps {
  searchParams: Promise<{ message?: string; erreur?: string }>;
}

export default async function MoiPage({ searchParams }: MoiPageProps) {
  const { message, erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/connexion");
  }

  const utilisateur = userData.user;

  // Les six requêtes ci-dessous sont indépendantes les unes des autres —
  // toutes lancées en parallèle plutôt qu'enchaînées en série (correctif
  // du 13/09/2026, même logique que sur l'accueil).
  const [
    { data: profil },
    { data: comptesRiot },
    { data: inscriptionsData, error: erreurInscriptions },
    { data: tournoisOrganisesData },
    { data: affiliationsData },
    { data: equipesCapitaineData },
    infoOffre,
    { data: matchsEnCoursData },
    { data: abonnement },
    mesDefis,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("pseudo, slug, created_at, avatar_url")
      .eq("id", utilisateur.id)
      .maybeSingle(),
    supabase
      .from("game_accounts")
      .select("riot_game_name, riot_tag_line, region, verifie_le, role_prefere")
      .eq("profile_id", utilisateur.id)
      .eq("est_principal", true)
      .maybeSingle(),
    supabase
      .from("registrations")
      .select(
        "id, statut, inscrit_le, tournament:tournaments(slug, nom, statut, debute_le, region, format, nature)",
      )
      .eq("profile_id", utilisateur.id)
      .order("inscrit_le", { ascending: false }),
    supabase
      .from("tournaments")
      .select("id, slug, nom, statut, debute_le, region, format")
      .eq("organisateur_id", utilisateur.id)
      // Défis arbitrés (administrateurs) : pas des tournois organisés.
      .eq("nature", "tournoi")
      .order("cree_le", { ascending: false }),
    supabase
      .from("team_members")
      .select("team_id, accepte_le, team:teams(id, slug, nom, tag, capitaine_id)")
      .eq("profile_id", utilisateur.id),
    supabase
      .from("teams")
      .select("id, slug, nom, tag")
      .eq("capitaine_id", utilisateur.id)
      .order("cree_le", { ascending: false }),
    chargerOffre(supabase, utilisateur.id),
    // Match à jouer (ou en attente d'adversaire) dans un tournoi en cours :
    // le premier écran utile un soir de tournoi (28/09/2026, audit N2).
    supabase
      .from("match_participants")
      .select("match:matches!inner(id, statut, tournament:tournaments!inner(nom, slug, statut))")
      .eq("profile_id", utilisateur.id)
      .in("match.statut", ["en_attente", "en_cours", "litige"])
      .eq("match.tournament.statut", "en_cours"),
    // Abonnement Stripe : ouvre le portail (moyen de paiement, factures,
    // résiliation).
    supabase.rpc("mon_abonnement_stripe").maybeSingle(),
    // Défis reçus, envoyés, liens d'invitation et duels (audit N16, N18).
    chargerMesDefis(supabase, utilisateur.id),
  ]);
  const matchsEnCours = (matchsEnCoursData ?? []).filter((p) => p.match?.tournament);

  // Les duels (défis) ont leur propre section, les scrims sont sur la page
  // de l'équipe (audit N22).
  const inscriptions = (inscriptionsData ?? []).filter((i) => i.tournament?.nature === "tournoi");
  const tournoisOrganises = tournoisOrganisesData ?? [];

  const affiliations = affiliationsData ?? [];
  const invitationsEnAttente = affiliations.filter((a) => a.accepte_le === null && a.team);
  const equipesMembre = affiliations.filter(
    (a) => a.accepte_le !== null && a.team && a.team.capitaine_id !== utilisateur.id,
  );

  const equipesCapitaine = equipesCapitaineData ?? [];

  // Chiffres de la saison en cours (revue visuelle du 05/10/2026) : les
  // mêmes que sur le CV public — rating, palier, rang national, matchs.
  const [{ data: saison }, { data: paliersData }] = await Promise.all([
    supabase.from("seasons").select("id, nom").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);
  const { data: monRating } = saison
    ? await supabase
        .from("ratings")
        .select("rating, rd, matchs_joues, est_classe")
        .eq("profile_id", utilisateur.id)
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .maybeSingle()
    : { data: null };
  const { count: devant } =
    saison && monRating?.est_classe
      ? await supabase
          .from("ratings")
          .select("profile_id", { count: "exact", head: true })
          .eq("game_id", 1)
          .eq("season_id", saison.id)
          .eq("est_classe", true)
          .gt("rating", monRating.rating)
      : { count: null };
  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const palier = monRating?.est_classe ? (trouverPalier(monRating.rating, paliers)?.nom ?? null) : null;
  const rang = monRating?.est_classe && devant !== null ? devant + 1 : null;

  // Inscriptions : en direct et à venir d'abord, puis les tournois passés.
  const lignesInscriptions = inscriptions.flatMap((i) =>
    i.tournament && estStatutPublic(i.tournament.statut)
      ? [{ id: i.id, ...i.tournament, statut: i.tournament.statut }]
      : [],
  );
  const g = grouperTournois(lignesInscriptions);
  const inscriptionsTriees = [...g.enDirect, ...g.aVenir, ...g.termines, ...g.annules];
  const lienCompte = "inline-flex min-h-11 items-center gap-2 rounded-bouton border border-line-strong px-4 font-texte text-[13px] font-semibold tracking-[2px] whitespace-nowrap text-text-2 uppercase transition-colors duration-200 hover:border-[rgba(245,245,244,0.25)] hover:text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        {(erreur || message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        {matchsEnCours.map(({ match }) => (
          <Panneau key={match!.id} className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden p-6">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
            <span className="flex min-w-0 flex-col gap-2">
              <span className="font-texte text-mini font-semibold text-accent uppercase">
                {match!.statut === "en_attente" ? "Prochain match" : "Ton match est ouvert"}
              </span>
              <span className="font-titre text-3xl leading-none font-black uppercase">{match!.tournament!.nom}</span>
              <span className="text-sm text-text-2">Adversaire, Riot ID et règles dans la salle de match.</span>
            </span>
            <BoutonLien href={`/lol/tournois/${match!.tournament!.slug}#ton-match`}>Aller à mon match</BoutonLien>
          </Panneau>
        ))}

        {profil && estPseudoAutomatique(profil.pseudo) && (
          <Panneau className="flex flex-wrap items-center justify-between gap-5 p-6">
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="font-texte text-mini font-semibold text-text uppercase">Choisis ton pseudo</span>
              <span className="text-sm text-text-2">
                « {profil.pseudo} » est un pseudo automatique : c&apos;est lui qui s&apos;affiche sur ton CV et dans les
                brackets.
              </span>
            </span>
            <BoutonLien href="/moi/profil" variante="contour">
              Choisir mon pseudo
            </BoutonLien>
          </Panneau>
        )}

        <Apparition className="flex flex-col gap-8 border-b border-line pb-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex min-w-0 items-center gap-5">
              <AvatarJoueur pseudo={profil?.pseudo ?? "?"} src={profil?.avatar_url ?? null} taille={72} />
              <div className="min-w-0">
                <LibelleSection>Mon compte</LibelleSection>
                <h1 className="mt-2 font-titre text-sous-titre font-black break-words uppercase">
                  {profil?.pseudo ?? "Mon compte"}
                </h1>
                {profil?.created_at && (
                  <p className="mt-2 text-sm text-muted tabular-nums">
                    Membre depuis le {formaterDate(profil.created_at).split(" ")[0]}
                  </p>
                )}
              </div>
            </div>
            <form action={seDeconnecter}>
              <button
                type="submit"
                className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-text"
              >
                Se déconnecter
              </button>
            </form>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <dt className="font-texte text-mini font-medium text-faint uppercase">Rating</dt>
              <dd className="font-titre text-5xl leading-none font-black tabular-nums">
                {monRating ? arrondir(monRating.rating) : "—"}
              </dd>
              <dd className="text-xs text-muted">{monRating?.est_classe ? "Confirmé" : "Provisoire — non classé"}</dd>
            </div>
            <div className="flex flex-col gap-2">
              <dt className="font-texte text-mini font-medium text-faint uppercase">Palier</dt>
              <dd className="flex items-center gap-2 font-titre text-3xl leading-none font-black uppercase">
                {palier ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: COULEUR_PALIER[palier.toLowerCase()] ?? "var(--color-muted)" }}
                    />
                    {palier}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-2">
              <dt className="font-texte text-mini font-medium text-faint uppercase">Rang national</dt>
              <dd className="font-titre text-5xl leading-none font-black tabular-nums">{rang ? `#${rang}` : "—"}</dd>
            </div>
            <div className="flex flex-col gap-2">
              <dt className="font-texte text-mini font-medium text-faint uppercase">Matchs{saison?.nom ? ` · ${saison.nom}` : ""}</dt>
              <dd className="font-titre text-5xl leading-none font-black tabular-nums">{monRating?.matchs_joues ?? 0}</dd>
            </div>
          </dl>

          <nav aria-label="Raccourcis du compte" className="flex flex-wrap gap-2">
            {profil?.slug && (
              <Link href={`/joueur/${profil.slug}`} className={lienCompte}>
                <Icone nom="joueur" taille={15} />
                Mon CV public
              </Link>
            )}
            <Link href="/moi/bilan" className={lienCompte}>
              <Icone nom="lecture" taille={15} />
              Mon bilan
            </Link>
            <Link href="/moi/messages" className={lienCompte}>
              <Icone nom="message" taille={15} />
              Messages
            </Link>
            <Link href="/moi/profil" className={lienCompte}>
              <Icone nom="crayon" taille={15} />
              Modifier mon profil
            </Link>
            {abonnement && (
              <form action={ouvrirPortailAbonnement}>
                <button type="submit" className={`${lienCompte} cursor-pointer`}>
                  Gérer mon abonnement
                </button>
              </form>
            )}
            {/* Cash prizes (audit N32), seulement une fois activés. */}
            {cashPrizesActifs() && (
              <Link href="/moi/gains" className={lienCompte}>
                Mes gains
              </Link>
            )}
            {infoOffre.offre === "organisateur" && (
              <>
                <Link href="/lol/recherche" className={lienCompte}>
                  Rechercher des joueurs
                </Link>
                <Link href="/moi/watchlist" className={lienCompte}>
                  Ma watchlist
                </Link>
              </>
            )}
          </nav>
        </Apparition>

        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-12">
            <Apparition delai={0.08}>
              <section>
                <SectionTitre>Mes inscriptions</SectionTitre>
                {erreurInscriptions ? (
                  <Alerte type="erreur" className="mt-4">
                    Impossible de charger tes inscriptions pour l&apos;instant. Réessaie dans un instant.
                  </Alerte>
                ) : inscriptionsTriees.length === 0 ? (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-text-2">Tu n&apos;es inscrit à aucun tournoi pour l&apos;instant.</p>
                    <BoutonLien href="/lol/tournois" variante="secondaire">
                      Voir les tournois
                    </BoutonLien>
                  </div>
                ) : (
                  <ul>
                    {inscriptionsTriees.map((t) => (
                      <li key={t.id}>
                        <LigneTournoiCompacte
                          href={`/lol/tournois/${t.slug}`}
                          nom={t.nom}
                          debuteLe={t.debute_le}
                          details={`${t.format} · ${t.region}`}
                          statut={t.statut}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Apparition>

            <Apparition delai={0.1}>
              <section>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SectionTitre>Tournois que j&apos;organise</SectionTitre>
                  </div>
                </div>
                {tournoisOrganises.length === 0 ? (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-text-2">Tu n&apos;organises aucun tournoi pour l&apos;instant.</p>
                    <BoutonLien href="/organiser/nouveau" variante="secondaire">
                      Organiser un tournoi
                    </BoutonLien>
                  </div>
                ) : (
                  <>
                    <ul>
                      {tournoisOrganises.map((t) => (
                        <li key={t.slug}>
                          <LigneTournoiCompacte
                            href={`/moi/organisation/${t.id}`}
                            nom={t.nom}
                            debuteLe={t.debute_le}
                            details={`${t.format} · ${t.region}`}
                            statut={t.statut}
                          />
                        </li>
                      ))}
                    </ul>
                    <BoutonLien href="/organiser/nouveau" variante="secondaire" className="mt-4">
                      Organiser un tournoi
                    </BoutonLien>
                  </>
                )}
              </section>
            </Apparition>

            <Apparition delai={0.12}>
              <SectionDefis defis={mesDefis} />
            </Apparition>
          </div>

          <Apparition delai={0.1} className="flex flex-col gap-10">
            <section aria-labelledby="moi-riot" className="flex flex-col gap-4">
              <LibelleSection as="h2" id="moi-riot" className="border-b border-line-strong pb-4">
                Compte Riot
              </LibelleSection>
              {comptesRiot ? (
                <>
                  <p className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold tabular-nums">
                      {comptesRiot.riot_game_name}
                      <span className="text-muted">#{comptesRiot.riot_tag_line}</span>
                      <span className="ml-2 text-sm font-normal text-muted">{comptesRiot.region}</span>
                    </span>
                    {comptesRiot.verifie_le ? (
                      <BadgeVerifie />
                    ) : (
                      <span className="font-texte text-mini font-semibold text-text-2 uppercase">Vérification en attente</span>
                    )}
                  </p>
                  {!comptesRiot.verifie_le && (
                    <Link href="/lier-riot" className="text-sm text-text underline underline-offset-3 hover:text-accent">
                      Terminer la vérification
                    </Link>
                  )}
                  <form action={mettreAJourRolePrefere} className="flex items-end gap-2">
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="font-texte text-mini font-medium text-muted uppercase">Poste préféré</span>
                      <select name="role_prefere" defaultValue={comptesRiot.role_prefere ?? ""} className={classeChamp()}>
                        <option value="">Non renseigné</option>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {LABEL_ROLE[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-bouton border border-line-strong px-4 text-sm text-text-2 hover:border-[rgba(245,245,244,0.25)] hover:text-text"
                    >
                      Enregistrer
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p className="text-sm text-text-2">
                    Aucun Riot ID lié pour l&apos;instant : il faut un compte vérifié pour t&apos;inscrire aux tournois.
                  </p>
                  <BoutonLien href="/lier-riot">Lier mon Riot ID</BoutonLien>
                </>
              )}
            </section>

            <section aria-labelledby="moi-equipes" className="flex flex-col gap-4">
              <LibelleSection as="h2" id="moi-equipes" className="border-b border-line-strong pb-4">
                Mes équipes
              </LibelleSection>
              {invitationsEnAttente.map((a) => (
                <div key={a.team_id} className="panneau flex flex-col gap-3 p-4">
                  <span className="text-sm">
                    <strong>{a.team?.tag}</strong> {a.team?.nom} t&apos;invite à rejoindre l&apos;équipe.
                  </span>
                  <span className="flex items-center gap-4">
                    <form action={accepterInvitation}>
                      <input type="hidden" name="team_id" value={a.team_id} />
                      <button
                        type="submit"
                        aria-label={`Accepter l'invitation de ${a.team?.nom}`}
                        className="inline-flex min-h-11 cursor-pointer items-center rounded-bouton border border-line-strong px-4 text-sm font-semibold hover:border-accent hover:text-accent"
                      >
                        Accepter
                      </button>
                    </form>
                    <form action={refuserInvitation}>
                      <input type="hidden" name="team_id" value={a.team_id} />
                      <button
                        type="submit"
                        aria-label={`Refuser l'invitation de ${a.team?.nom}`}
                        className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
                      >
                        Refuser
                      </button>
                    </form>
                  </span>
                </div>
              ))}
              {equipesCapitaine.length === 0 && equipesMembre.length === 0 ? (
                <p className="text-sm text-text-2">Tu ne fais partie d&apos;aucune équipe pour l&apos;instant.</p>
              ) : (
                <ul className="flex flex-col">
                  {equipesCapitaine.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/equipe/${e.slug}`}
                        className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-3 hover:text-accent"
                      >
                        <span className="font-semibold">
                          <span className="text-muted">{e.tag}</span> {e.nom}
                        </span>
                        <span className="font-texte text-[10px] font-semibold tracking-[2px] text-text-2 uppercase">Capitaine</span>
                      </Link>
                    </li>
                  ))}
                  {equipesMembre.map((a) => (
                    <li key={a.team_id}>
                      <Link
                        href={`/equipe/${a.team!.slug}`}
                        className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-3 hover:text-accent"
                      >
                        <span className="font-semibold">
                          <span className="text-muted">{a.team!.tag}</span> {a.team!.nom}
                        </span>
                        <span className="font-texte text-[10px] font-semibold tracking-[2px] text-muted uppercase">Membre</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <span className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <Link href="/equipe/nouvelle" className="text-text underline underline-offset-3 hover:text-accent">
                  Créer une équipe
                </Link>
                <Link href="/lol/coequipiers" className="text-muted underline underline-offset-3 hover:text-text">
                  Trouver un coéquipier
                </Link>
              </span>
            </section>

            <section aria-labelledby="moi-notifications" className="flex flex-col gap-4">
              <LibelleSection as="h2" id="moi-notifications" className="border-b border-line-strong pb-4">
                Notifications
              </LibelleSection>
              <PushOptIn />
            </section>
          </Apparition>
        </div>
      </div>
    </main>
  );
}
