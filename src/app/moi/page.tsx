import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { seDeconnecter } from "@/lib/auth-actions";
import { mettreAJourRolePrefere } from "@/lib/riot-actions";
import { ROLES, LABEL_ROLE } from "@/lib/roles";
import { chargerOffre } from "@/lib/offres";
import { LABEL_STATUT, COULEUR_STATUT, formaterDate, type StatutPublic } from "@/lib/tournois";
import { accepterInvitation, refuserInvitation } from "@/lib/equipe-actions";
import PushOptIn from "@/components/PushOptIn";
import { classeCarte, accentDepuisCouleur } from "@/lib/ui";
import Badge from "@/components/ui/Badge";
import SectionTitre from "@/components/ui/SectionTitre";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Mon compte — Najarena",
  robots: { index: false, follow: false },
};

interface MoiPageProps {
  searchParams: Promise<{ message?: string }>;
}

export default async function MoiPage({ searchParams }: MoiPageProps) {
  const { message } = await searchParams;

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
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("pseudo, slug, created_at")
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
        "id, statut, inscrit_le, tournament:tournaments(slug, nom, statut, debute_le, region, format)",
      )
      .eq("profile_id", utilisateur.id)
      .order("inscrit_le", { ascending: false }),
    supabase
      .from("tournaments")
      .select("id, slug, nom, statut, debute_le, region, format")
      .eq("organisateur_id", utilisateur.id)
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
  ]);

  const inscriptions = inscriptionsData ?? [];
  const tournoisOrganises = tournoisOrganisesData ?? [];

  const affiliations = affiliationsData ?? [];
  const invitationsEnAttente = affiliations.filter((a) => a.accepte_le === null && a.team);
  const equipesMembre = affiliations.filter(
    (a) => a.accepte_le !== null && a.team && a.team.capitaine_id !== utilisateur.id,
  );

  const equipesCapitaine = equipesCapitaineData ?? [];

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-5xl px-gouttiere">
      {message && (
        <p className={"mb-6 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
      )}

      <Apparition>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-titre uppercase text-section font-black tracking-[1px] text-text break-words">
            {profil?.pseudo ?? "Mon compte"}
          </h1>
          {profil?.created_at && (
            <p className="mt-1 font-texte tabular-nums text-[0.7rem] text-muted">
              Membre depuis le {formaterDate(profil.created_at)}
            </p>
          )}
        </div>

        <form action={seDeconnecter}>
          <button
            type="submit"
            className="rounded-[3px] border border-line px-3 py-2 font-texte tabular-nums text-[0.66rem] tracking-[0.1em] text-muted uppercase hover:border-text hover:text-text"
          >
            Se déconnecter
          </button>
        </form>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {profil?.slug && (
          <Link
            href={`/joueur/${profil.slug}`}
            className="inline-block text-sm text-muted underline underline-offset-3 hover:text-text"
          >
            Voir mon profil public
          </Link>
        )}
        <Link
          href="/moi/messages"
          className="inline-block text-sm text-muted underline underline-offset-3 hover:text-text"
        >
          Messages
        </Link>
        {infoOffre.offre === "organisateur" && (
          <>
            <Link
              href="/lol/recherche"
              className="inline-block text-sm text-muted underline underline-offset-3 hover:text-text"
            >
              Rechercher des joueurs
            </Link>
            <Link
              href="/moi/watchlist"
              className="inline-block text-sm text-muted underline underline-offset-3 hover:text-text"
            >
              Ma watchlist
            </Link>
          </>
        )}
      </div>
      </Apparition>

      <Apparition delai={0.08}>
      <section className="mt-10">
        <SectionTitre>Riot ID</SectionTitre>
        {comptesRiot ? (
          <div className={"mt-3 flex items-center justify-between " + classeCarte(comptesRiot.verifie_le ? "atteste" : "laiton")}>
            <span className="font-texte tabular-nums text-sm text-text">
              {comptesRiot.riot_game_name}#{comptesRiot.riot_tag_line}{" "}
              <span className="text-muted">· {comptesRiot.region}</span>
            </span>
            <Badge couleur={comptesRiot.verifie_le ? "text-accent" : "text-accent"}>
              {comptesRiot.verifie_le ? "Vérifié" : "Vérification en attente"}
            </Badge>
          </div>
        ) : null}
        {comptesRiot && (
          <form action={mettreAJourRolePrefere} className="mt-2 flex items-center gap-2">
            <span className="font-texte text-mini font-medium text-muted uppercase">
              Rôle préféré
            </span>
            <select
              name="role_prefere"
              defaultValue={comptesRiot.role_prefere ?? ""}
              className="rounded-[3px] border border-line bg-bg px-2 py-1 text-sm text-text"
            >
              <option value="">Non renseigné</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {LABEL_ROLE[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="font-texte tabular-nums text-[0.66rem] text-accent underline underline-offset-3"
            >
              Enregistrer
            </button>
          </form>
        )}
        {!comptesRiot && (
          <div className={"mt-3 flex items-center justify-between " + classeCarte("none")}>
            <span className="text-sm text-muted">Aucun Riot ID lié pour l&apos;instant.</span>
            <Link
              href="/lier-riot"
              className="font-texte tabular-nums text-[0.7rem] text-accent underline underline-offset-3"
            >
              Lier mon Riot ID
            </Link>
          </div>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.12}>
      <section className="mt-10">
        <SectionTitre>Notifications</SectionTitre>
        <div className="mt-3">
          <PushOptIn />
        </div>
      </section>
      </Apparition>

      <Apparition delai={0.16}>
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitre>Mes équipes</SectionTitre>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/lol/coequipiers"
              className="font-texte tabular-nums text-[0.7rem] text-muted underline underline-offset-3 hover:text-text"
            >
              Trouver un coéquipier
            </Link>
            <Link
              href="/equipe/nouvelle"
              className="font-texte tabular-nums text-[0.7rem] text-accent underline underline-offset-3"
            >
              Créer une équipe
            </Link>
          </div>
        </div>

        {invitationsEnAttente.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {invitationsEnAttente.map((a) => (
              <li key={a.team_id} className={"flex items-center justify-between " + classeCarte("laiton")}>
                <span className="text-sm text-text">
                  <strong>{a.team?.tag}</strong> {a.team?.nom} t&apos;invite
                </span>
                <div className="flex items-center gap-3">
                  <form action={accepterInvitation}>
                    <input type="hidden" name="team_id" value={a.team_id} />
                    <button
                      type="submit"
                      aria-label={`Accepter l'invitation de ${a.team?.nom}`}
                      className="font-texte tabular-nums text-[0.66rem] text-accent underline underline-offset-3"
                    >
                      Accepter
                    </button>
                  </form>
                  <form action={refuserInvitation}>
                    <input type="hidden" name="team_id" value={a.team_id} />
                    <button
                      type="submit"
                      aria-label={`Refuser l'invitation de ${a.team?.nom}`}
                      className="font-texte tabular-nums text-[0.66rem] text-danger underline underline-offset-3"
                    >
                      Refuser
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {equipesCapitaine.length === 0 && equipesMembre.length === 0 ? (
          <div className="mt-3">
            <EtatVide illustration={<IllustrationEffectifVide />}>
              Tu ne fais partie d&apos;aucune équipe pour l&apos;instant.
            </EtatVide>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {equipesCapitaine.map((e) => (
              <li key={e.id}>
                <Link href={`/equipe/${e.slug}`} className={"flex items-center justify-between " + classeCarte("laiton", true)}>
                  <span className="text-sm font-medium text-text">
                    <strong>{e.tag}</strong> {e.nom}
                  </span>
                  <Badge couleur="text-accent">Capitaine</Badge>
                </Link>
              </li>
            ))}
            {equipesMembre.map((a) => (
              <li key={a.team_id}>
                <Link href={`/equipe/${a.team!.slug}`} className={"flex items-center justify-between " + classeCarte("none", true)}>
                  <span className="text-sm font-medium text-text">
                    <strong>{a.team!.tag}</strong> {a.team!.nom}
                  </span>
                  <Badge couleur="text-muted">Membre</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.2}>
      <section className="mt-10">
        <SectionTitre>Mes inscriptions</SectionTitre>

        {erreurInscriptions ? (
          <p className={"mt-3 " + classeCarte("sceau") + " text-sm text-danger"}>
            Impossible de charger tes inscriptions pour l&apos;instant.
            Réessaie dans un instant.
          </p>
        ) : inscriptions.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-muted"}>
            Tu n&apos;es inscrit à aucun tournoi pour l&apos;instant.{" "}
            <Link href="/lol/tournois" className="text-text underline underline-offset-3">
              Voir les tournois
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {inscriptions.map((i) => {
              if (!i.tournament) return null;
              const statut = i.tournament.statut as StatutPublic;
              const couleur = COULEUR_STATUT[statut] ?? "text-muted";
              return (
                <li key={i.id}>
                  <Link
                    href={`/lol/tournois/${i.tournament.slug}`}
                    className={"block " + classeCarte(accentDepuisCouleur(couleur), true)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
                        {i.tournament.nom}
                      </span>
                      <Badge couleur={couleur}>{LABEL_STATUT[statut] ?? i.tournament.statut}</Badge>
                    </div>
                    <div className="mt-2 font-texte tabular-nums text-[0.72rem] text-muted">
                      {i.tournament.format} · {i.tournament.region} ·{" "}
                      {formaterDate(i.tournament.debute_le)}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.24}>
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitre>Tournois que j&apos;organise</SectionTitre>
          <Link
            href="/organiser/nouveau"
            className="font-texte tabular-nums text-[0.7rem] text-accent underline underline-offset-3"
          >
            Organiser un tournoi
          </Link>
        </div>

        {tournoisOrganises.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-muted"}>
            Tu n&apos;organises aucun tournoi pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tournoisOrganises.map((t) => {
              const estBrouillon = t.statut === "brouillon";
              const couleur = estBrouillon ? "text-muted" : COULEUR_STATUT[t.statut as StatutPublic] ?? "text-muted";
              const contenu = (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
                      {t.nom}
                    </span>
                    <Badge couleur={couleur}>
                      {estBrouillon
                        ? "Brouillon — non publié"
                        : LABEL_STATUT[t.statut as StatutPublic] ?? t.statut}
                    </Badge>
                  </div>
                  <div className="mt-2 font-texte tabular-nums text-[0.72rem] text-muted">
                    {t.format} · {t.region} · {formaterDate(t.debute_le)}
                  </div>
                </>
              );

              return (
                <li key={t.slug} className={classeCarte(accentDepuisCouleur(couleur), true)}>
                  <Link href={`/moi/organisation/${t.id}`} className="block">
                    {contenu}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </Apparition>
      </div>
    </main>
  );
}
