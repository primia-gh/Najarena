import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resoudreLitigeAdmin } from "@/lib/admin-actions";
import { attribuerOffreAdmin } from "@/lib/offres-actions";
import { LABEL_OFFRE, chargerOffres, type Offre } from "@/lib/offres";
import { formaterDate } from "@/lib/tournois";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import SectionTitre from "@/components/ui/SectionTitre";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Administration — Najarena",
  robots: { index: false, follow: false },
};

interface AdminPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { erreur, message } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    return (
      <main className="mx-auto box-content max-w-md px-gouttiere pt-32 pb-24 font-texte text-text">
        <p className={classeCarte("sceau") + " text-sm text-danger"}>
          Accès réservé aux administrateurs.
        </p>
        <Link
          href="/moi"
          className="mt-4 inline-block text-sm text-muted underline underline-offset-3 hover:text-text"
        >
          Retour à mon compte
        </Link>
      </main>
    );
  }

  // Six requêtes indépendantes entre elles, lancées en parallèle plutôt
  // qu'en série (correctif du 13/09/2026, même logique que sur l'accueil).
  // Regroupées ici, après la vérification `admin` ci-dessus — jamais avant :
  // ce sont des requêtes coûteuses (comptages, jointures), on évite de les
  // lancer pour un visiteur non admin qui tombe sur /admin.
  const [
    { data: litigesData, error: erreurLitiges },
    { count: totalJoueurs },
    { count: tournoisActifs },
    { count: tournoisTotal },
    { count: matchsEnregistres },
    { data: derniersInscrits },
  ] = await Promise.all([
    supabase
      .from("disputes")
      .select(
        "id, motif, resolution, resolu_le, cree_le, match_id, ouvert_par:profiles!disputes_ouvert_par_fkey(pseudo, slug), resolu_par:profiles!disputes_resolu_par_fkey(pseudo, slug), match:matches(tour, tournament:tournaments(nom, slug))",
      )
      .order("cree_le", { ascending: false }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .in("statut", ["ouvert", "checkin", "en_cours"]),
    supabase.from("tournaments").select("*", { count: "exact", head: true }),
    supabase.from("match_verdicts").select("*", { count: "exact", head: true }).eq("est_definitif", true),
    supabase
      .from("profiles")
      .select(
        "id, pseudo, slug, pays, created_at, game_accounts(verifie_le), admins(profile_id)",
      )
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const litiges = litigesData ?? [];
  const litigesOuverts = litiges.filter((l) => !l.resolution);
  const litigesResolus = litiges.filter((l) => l.resolution);
  const comptes = derniersInscrits ?? [];
  const offresParCompte = await chargerOffres(supabase, comptes.map((c) => c.id));

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-5xl px-gouttiere">
      <Apparition>
      <Link
        href="/moi"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Administration
      </h1>
      <p className="mt-1 font-texte tabular-nums text-[0.72rem] text-muted">Modération · Litiges</p>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}
      {message && (
        <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
      )}
      </Apparition>

      <Apparition delai={0.1}>
      <section className="mt-10">
        <SectionTitre>Vue d&apos;ensemble</SectionTitre>
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[3px] border border-line bg-surface shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)] sm:grid-cols-4">
          <div className="border-r border-b border-line p-4 sm:border-b-0">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Joueurs
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {totalJoueurs ?? 0}
            </div>
          </div>
          <div className="border-b border-line p-4 sm:border-r sm:border-b-0">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Tournois actifs
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {tournoisActifs ?? 0}
            </div>
          </div>
          <div className="border-r border-line p-4">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Tournois créés
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {tournoisTotal ?? 0}
            </div>
          </div>
          <div className="p-4">
            <div className="font-texte tabular-nums text-mini tracking-[0.16em] text-muted uppercase">
              Matchs enregistrés
            </div>
            <div className="mt-0.5 font-texte tabular-nums text-2xl font-bold tracking-tight text-text">
              {matchsEnregistres ?? 0}
            </div>
          </div>
        </div>
      </section>
      </Apparition>

      <Apparition delai={0.12}>
      <section className="mt-10">
        <SectionTitre>Attribuer une offre</SectionTitre>
        <p className="mt-1 text-sm text-muted">
          En attendant Stripe — comptes offerts, tests, streamers partenaires.
        </p>
        <form action={attribuerOffreAdmin} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Pseudo du joueur</span>
            <input
              name="pseudo"
              type="text"
              required
              placeholder="Pseudo du joueur"
              className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          <label>
            <span className="sr-only">Offre à attribuer</span>
            <select
              name="offre"
              defaultValue="verifie"
              className="w-full min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
            >
              <option value="gratuit">Gratuit (révoquer)</option>
              <option value="verifie">Vérifié</option>
              <option value="elite">Elite</option>
              <option value="organisateur">Organisateur</option>
            </select>
          </label>
          <Bouton libelleEnCours="Attribution…">Attribuer</Bouton>
        </form>
      </section>
      </Apparition>

      <Apparition delai={0.15}>
      <section className="mt-10">
        <SectionTitre>Derniers inscrits</SectionTitre>
        {comptes.length === 0 ? (
          <div className="mt-3">
            <EtatVide illustration={<IllustrationEffectifVide />}>
              Aucun compte pour l&apos;instant.
            </EtatVide>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[3px] border border-line bg-surface shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Joueur
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Inscrit le
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Riot ID
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Rôle
                  </th>
                  <th className="px-4 py-2 font-texte tabular-nums text-mini tracking-[0.12em] text-muted uppercase">
                    Offre
                  </th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((c) => {
                  const offre = offresParCompte.get(c.id)?.offre as Exclude<Offre, "gratuit"> | undefined;
                  return (
                  <tr key={c.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2">
                      <Link href={`/joueur/${c.slug}`} className="font-medium text-text hover:underline">
                        {c.pseudo}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem] text-muted">
                      {formaterDate(c.created_at)}
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem]">
                      {c.game_accounts.some((g) => g.verifie_le) ? (
                        <span className="text-accent">Vérifié</span>
                      ) : (
                        <span className="text-muted">Non lié</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem] text-muted">
                      {c.admins ? "Admin" : "Joueur"}
                    </td>
                    <td className="px-4 py-2 font-texte tabular-nums text-[0.72rem] text-muted">
                      {offre ? LABEL_OFFRE[offre] : "Gratuit"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.2}>
      <section className="mt-10">
        <SectionTitre>Litiges ouverts ({litigesOuverts.length})</SectionTitre>

        {erreurLitiges ? (
          <p className={"mt-3 " + classeCarte("sceau") + " text-sm text-danger"}>
            Impossible de charger les litiges pour l&apos;instant.
          </p>
        ) : litigesOuverts.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-muted"}>
            Aucun litige ouvert.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {litigesOuverts.map((l) => (
              <li key={l.id} className={classeCarte("sceau")}>
                {l.match?.tournament && (
                  <Link
                    href={`/lol/tournois/${l.match.tournament.slug}`}
                    className="font-texte tabular-nums text-mini text-muted uppercase hover:text-text"
                  >
                    {l.match.tournament.nom} · Tour {l.match.tour}
                  </Link>
                )}
                <p className="mt-1 text-sm text-text">
                  Ouvert par{" "}
                  <span className="font-medium">{l.ouvert_par?.pseudo ?? "un joueur"}</span> le{" "}
                  {formaterDate(l.cree_le)}
                </p>
                <p className="mt-1 text-sm text-muted">{l.motif}</p>
                <form action={resoudreLitigeAdmin} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="dispute_id" value={l.id} />
                  <label>
                    <span className="sr-only">
                      Résolution du litige
                      {l.match?.tournament
                        ? ` — ${l.match.tournament.nom}, tour ${l.match.tour}`
                        : ""}
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
                    aria-label={`Résoudre le litige${l.match?.tournament ? ` — ${l.match.tournament.nom}, tour ${l.match.tour}` : ""}`}
                    libelleEnCours="Résolution…"
                    className="self-start"
                  >
                    Résoudre
                  </Bouton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>

      <Apparition delai={0.25}>
      <section className="mt-10">
        <SectionTitre>Litiges résolus</SectionTitre>
        {litigesResolus.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-muted"}>
            Aucun litige résolu pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {litigesResolus.map((l) => (
              <li key={l.id} className={classeCarte("atteste")}>
                {l.match?.tournament && (
                  <span className="font-texte tabular-nums text-mini text-muted uppercase">
                    {l.match.tournament.nom} · Tour {l.match.tour}
                  </span>
                )}
                <p className="mt-1 text-sm text-text">{l.motif}</p>
                <p className="mt-1 text-sm text-accent">
                  Résolu par {l.resolu_par?.pseudo ?? "un administrateur"} : {l.resolution}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Apparition>
      </div>
    </main>
  );
}
