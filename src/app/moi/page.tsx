import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { seDeconnecter } from "@/lib/auth-actions";
import { LABEL_STATUT, COULEUR_STATUT, formaterDate, type StatutPublic } from "@/lib/tournois";
import { accepterInvitation, refuserInvitation } from "@/lib/equipe-actions";
import PushOptIn from "@/components/PushOptIn";

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

  const { data: profil } = await supabase
    .from("profiles")
    .select("pseudo, slug, created_at")
    .eq("id", utilisateur.id)
    .maybeSingle();

  const { data: comptesRiot } = await supabase
    .from("game_accounts")
    .select("riot_game_name, riot_tag_line, region, verifie_le")
    .eq("profile_id", utilisateur.id)
    .eq("est_principal", true)
    .maybeSingle();

  const { data: inscriptionsData, error: erreurInscriptions } = await supabase
    .from("registrations")
    .select(
      "id, statut, inscrit_le, tournament:tournaments(slug, nom, statut, debute_le, region, format)",
    )
    .eq("profile_id", utilisateur.id)
    .order("inscrit_le", { ascending: false });

  const inscriptions = inscriptionsData ?? [];

  const { data: tournoisOrganisesData } = await supabase
    .from("tournaments")
    .select("id, slug, nom, statut, debute_le, region, format")
    .eq("organisateur_id", utilisateur.id)
    .order("cree_le", { ascending: false });

  const tournoisOrganises = tournoisOrganisesData ?? [];

  const { data: affiliationsData } = await supabase
    .from("team_members")
    .select("team_id, accepte_le, team:teams(id, slug, nom, tag, capitaine_id)")
    .eq("profile_id", utilisateur.id);

  const affiliations = affiliationsData ?? [];
  const invitationsEnAttente = affiliations.filter((a) => a.accepte_le === null && a.team);
  const equipesMembre = affiliations.filter(
    (a) => a.accepte_le !== null && a.team && a.team.capitaine_id !== utilisateur.id,
  );

  const { data: equipesCapitaineData } = await supabase
    .from("teams")
    .select("id, slug, nom, tag")
    .eq("capitaine_id", utilisateur.id)
    .order("cree_le", { ascending: false });

  const equipesCapitaine = equipesCapitaineData ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      {message && (
        <p className="mt-6 rounded-[3px] border border-atteste/30 bg-atteste/10 p-3 text-sm text-atteste">
          {message}
        </p>
      )}

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-encre">
            {profil?.pseudo ?? "Mon compte"}
          </h1>
          {profil?.created_at && (
            <p className="mt-1 font-mono text-[0.7rem] text-ardoise">
              Membre depuis le {formaterDate(profil.created_at)}
            </p>
          )}
        </div>

        <form action={seDeconnecter}>
          <button
            type="submit"
            className="rounded-[3px] border border-trait px-3 py-2 font-mono text-[0.66rem] tracking-[0.1em] text-ardoise uppercase hover:border-encre hover:text-encre"
          >
            Se déconnecter
          </button>
        </form>
      </div>

      {profil?.slug && (
        <Link
          href={`/joueur/${profil.slug}`}
          className="mt-2 inline-block text-sm text-ardoise underline underline-offset-3 hover:text-encre"
        >
          Voir mon profil public
        </Link>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Riot ID
        </h2>
        {comptesRiot ? (
          <div className="mt-3 flex items-center justify-between rounded-[3px] border border-trait bg-carte p-4">
            <span className="font-mono text-sm text-encre">
              {comptesRiot.riot_game_name}#{comptesRiot.riot_tag_line}{" "}
              <span className="text-ardoise">· {comptesRiot.region}</span>
            </span>
            <span
              className={`font-mono text-[0.62rem] tracking-[0.1em] uppercase ${
                comptesRiot.verifie_le ? "text-atteste" : "text-laiton-texte"
              }`}
            >
              {comptesRiot.verifie_le ? "Vérifié" : "Vérification en attente"}
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between rounded-[3px] border border-trait bg-carte p-4">
            <span className="text-sm text-ardoise">Aucun Riot ID lié pour l&apos;instant.</span>
            <Link
              href="/lier-riot"
              className="font-mono text-[0.7rem] text-sceau underline underline-offset-3"
            >
              Lier mon Riot ID
            </Link>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Notifications
        </h2>
        <PushOptIn />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
            Mes équipes
          </h2>
          <Link
            href="/equipe/nouvelle"
            className="font-mono text-[0.7rem] text-sceau underline underline-offset-3"
          >
            Créer une équipe
          </Link>
        </div>

        {invitationsEnAttente.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {invitationsEnAttente.map((a) => (
              <li
                key={a.team_id}
                className="flex items-center justify-between rounded-[3px] border border-laiton-texte/30 bg-laiton-texte/10 px-4 py-3"
              >
                <span className="text-sm text-encre">
                  <strong>{a.team?.tag}</strong> {a.team?.nom} t&apos;invite
                </span>
                <div className="flex items-center gap-3">
                  <form action={accepterInvitation}>
                    <input type="hidden" name="team_id" value={a.team_id} />
                    <button
                      type="submit"
                      aria-label={`Accepter l'invitation de ${a.team?.nom}`}
                      className="font-mono text-[0.66rem] text-atteste underline underline-offset-3"
                    >
                      Accepter
                    </button>
                  </form>
                  <form action={refuserInvitation}>
                    <input type="hidden" name="team_id" value={a.team_id} />
                    <button
                      type="submit"
                      aria-label={`Refuser l'invitation de ${a.team?.nom}`}
                      className="font-mono text-[0.66rem] text-sceau underline underline-offset-3"
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
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Tu ne fais partie d&apos;aucune équipe pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {equipesCapitaine.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/equipe/${e.slug}`}
                  className="flex items-center justify-between rounded-[3px] border border-trait bg-carte px-4 py-2 transition hover:border-encre"
                >
                  <span className="text-sm font-medium text-encre">
                    <strong>{e.tag}</strong> {e.nom}
                  </span>
                  <span className="font-mono text-[0.6rem] tracking-[0.1em] text-ardoise uppercase">
                    Capitaine
                  </span>
                </Link>
              </li>
            ))}
            {equipesMembre.map((a) => (
              <li key={a.team_id}>
                <Link
                  href={`/equipe/${a.team!.slug}`}
                  className="flex items-center justify-between rounded-[3px] border border-trait bg-carte px-4 py-2 transition hover:border-encre"
                >
                  <span className="text-sm font-medium text-encre">
                    <strong>{a.team!.tag}</strong> {a.team!.nom}
                  </span>
                  <span className="font-mono text-[0.6rem] tracking-[0.1em] text-ardoise uppercase">
                    Membre
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Mes inscriptions
        </h2>

        {erreurInscriptions ? (
          <p className="mt-3 rounded-[3px] border border-sceau/30 bg-sceau/10 p-4 text-sm text-sceau">
            Impossible de charger tes inscriptions pour l&apos;instant.
            Réessaie dans un instant.
          </p>
        ) : inscriptions.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Tu n&apos;es inscrit à aucun tournoi pour l&apos;instant.{" "}
            <Link href="/lol/tournois" className="text-encre underline underline-offset-3">
              Voir les tournois
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {inscriptions.map((i) => {
              if (!i.tournament) return null;
              const statut = i.tournament.statut as StatutPublic;
              return (
                <li key={i.id}>
                  <Link
                    href={`/lol/tournois/${i.tournament.slug}`}
                    className="block rounded-[3px] border border-trait bg-carte p-4 transition hover:border-encre"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-lg font-extrabold tracking-tight text-encre">
                        {i.tournament.nom}
                      </span>
                      <span
                        className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase ${
                          COULEUR_STATUT[statut] ?? "text-ardoise"
                        }`}
                      >
                        {LABEL_STATUT[statut] ?? i.tournament.statut}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[0.72rem] text-ardoise">
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

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
            Tournois que j&apos;organise
          </h2>
          <Link
            href="/organiser/nouveau"
            className="font-mono text-[0.7rem] text-sceau underline underline-offset-3"
          >
            Organiser un tournoi
          </Link>
        </div>

        {tournoisOrganises.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Tu n&apos;organises aucun tournoi pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tournoisOrganises.map((t) => {
              const estBrouillon = t.statut === "brouillon";
              const contenu = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-lg font-extrabold tracking-tight text-encre">
                      {t.nom}
                    </span>
                    <span
                      className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase ${
                        estBrouillon
                          ? "text-ardoise"
                          : COULEUR_STATUT[t.statut as StatutPublic] ?? "text-ardoise"
                      }`}
                    >
                      {estBrouillon
                        ? "Brouillon — non publié"
                        : LABEL_STATUT[t.statut as StatutPublic] ?? t.statut}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-[0.72rem] text-ardoise">
                    {t.format} · {t.region} · {formaterDate(t.debute_le)}
                  </div>
                </>
              );

              return (
                <li
                  key={t.slug}
                  className="rounded-[3px] border border-trait bg-carte p-4 transition hover:border-encre"
                >
                  <Link href={`/moi/organisation/${t.id}`} className="block">
                    {contenu}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
