import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resoudreLitigeAdmin } from "@/lib/admin-actions";
import { formaterDate } from "@/lib/tournois";
import { classeCarte, classeBoutonPrimaire } from "@/lib/ui";
import SectionTitre from "@/components/ui/SectionTitre";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

export const metadata: Metadata = {
  title: "Administration — Najarena",
  robots: { index: false, follow: false },
};

interface AdminPageProps {
  searchParams: Promise<{ erreur?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { erreur } = await searchParams;

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
      <main className="mx-auto max-w-md px-6 pt-28 pb-16">
        <p className={classeCarte("sceau") + " text-sm text-sceau-texte"}>
          Accès réservé aux administrateurs.
        </p>
        <Link
          href="/moi"
          className="mt-4 inline-block text-sm text-ardoise underline underline-offset-3 hover:text-encre"
        >
          Retour à mon compte
        </Link>
      </main>
    );
  }

  const { data: litigesData, error: erreurLitiges } = await supabase
    .from("disputes")
    .select(
      "id, motif, resolution, resolu_le, cree_le, match_id, ouvert_par:profiles!disputes_ouvert_par_fkey(pseudo, slug), resolu_par:profiles!disputes_resolu_par_fkey(pseudo, slug), match:matches(tour, tournament:tournaments(nom, slug))",
    )
    .order("cree_le", { ascending: false });

  const litiges = litigesData ?? [];
  const litigesOuverts = litiges.filter((l) => !l.resolution);
  const litigesResolus = litiges.filter((l) => l.resolution);

  const [
    { count: totalJoueurs },
    { count: tournoisActifs },
    { count: tournoisTotal },
    { count: matchsEnregistres },
    { data: derniersInscrits },
  ] = await Promise.all([
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

  const comptes = derniersInscrits ?? [];

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
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

      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-encre">
        Administration
      </h1>
      <p className="mt-1 font-mono text-[0.72rem] text-ardoise">Modération · Litiges</p>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
      )}
      </Reveal>

      <Reveal delai={0.1}>
      <section className="mt-10">
        <SectionTitre>Vue d&apos;ensemble</SectionTitre>
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[3px] border border-trait bg-carte shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)] sm:grid-cols-4">
          <div className="border-r border-b border-trait p-4 sm:border-b-0">
            <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
              Joueurs
            </div>
            <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
              {totalJoueurs ?? 0}
            </div>
          </div>
          <div className="border-b border-trait p-4 sm:border-r sm:border-b-0">
            <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
              Tournois actifs
            </div>
            <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
              {tournoisActifs ?? 0}
            </div>
          </div>
          <div className="border-r border-trait p-4">
            <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
              Tournois créés
            </div>
            <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
              {tournoisTotal ?? 0}
            </div>
          </div>
          <div className="p-4">
            <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
              Matchs enregistrés
            </div>
            <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
              {matchsEnregistres ?? 0}
            </div>
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal delai={0.15}>
      <section className="mt-10">
        <SectionTitre>Derniers inscrits</SectionTitre>
        {comptes.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-ardoise"}>
            Aucun compte pour l&apos;instant.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[3px] border border-trait bg-carte shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-trait">
                  <th className="px-4 py-2 font-mono text-[0.6rem] tracking-[0.12em] text-ardoise uppercase">
                    Joueur
                  </th>
                  <th className="px-4 py-2 font-mono text-[0.6rem] tracking-[0.12em] text-ardoise uppercase">
                    Inscrit le
                  </th>
                  <th className="px-4 py-2 font-mono text-[0.6rem] tracking-[0.12em] text-ardoise uppercase">
                    Riot ID
                  </th>
                  <th className="px-4 py-2 font-mono text-[0.6rem] tracking-[0.12em] text-ardoise uppercase">
                    Rôle
                  </th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((c) => (
                  <tr key={c.id} className="border-b border-trait last:border-b-0">
                    <td className="px-4 py-2">
                      <Link href={`/joueur/${c.slug}`} className="font-medium text-encre hover:underline">
                        {c.pseudo}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-[0.72rem] text-ardoise">
                      {formaterDate(c.created_at)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[0.72rem]">
                      {c.game_accounts.some((g) => g.verifie_le) ? (
                        <span className="text-atteste">Vérifié</span>
                      ) : (
                        <span className="text-ardoise">Non lié</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-[0.72rem] text-ardoise">
                      {c.admins ? "Admin" : "Joueur"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </Reveal>

      <Reveal delai={0.2}>
      <section className="mt-10">
        <SectionTitre>Litiges ouverts ({litigesOuverts.length})</SectionTitre>

        {erreurLitiges ? (
          <p className={"mt-3 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>
            Impossible de charger les litiges pour l&apos;instant.
          </p>
        ) : litigesOuverts.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-ardoise"}>
            Aucun litige ouvert.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {litigesOuverts.map((l) => (
              <li key={l.id} className={classeCarte("sceau")}>
                {l.match?.tournament && (
                  <Link
                    href={`/lol/tournois/${l.match.tournament.slug}`}
                    className="font-mono text-[0.66rem] text-ardoise uppercase hover:text-encre"
                  >
                    {l.match.tournament.nom} · Tour {l.match.tour}
                  </Link>
                )}
                <p className="mt-1 text-sm text-encre">
                  Ouvert par{" "}
                  <span className="font-medium">{l.ouvert_par?.pseudo ?? "un joueur"}</span> le{" "}
                  {formaterDate(l.cree_le)}
                </p>
                <p className="mt-1 text-sm text-ardoise">{l.motif}</p>
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
                      className="w-full rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
                    />
                  </label>
                  <button
                    type="submit"
                    aria-label={`Résoudre le litige${l.match?.tournament ? ` — ${l.match.tournament.nom}, tour ${l.match.tour}` : ""}`}
                    className={"self-start " + classeBoutonPrimaire()}
                  >
                    Résoudre
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Reveal>

      <Reveal delai={0.25}>
      <section className="mt-10">
        <SectionTitre>Litiges résolus</SectionTitre>
        {litigesResolus.length === 0 ? (
          <p className={"mt-3 " + classeCarte("none") + " text-sm text-ardoise"}>
            Aucun litige résolu pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {litigesResolus.map((l) => (
              <li key={l.id} className={classeCarte("atteste")}>
                {l.match?.tournament && (
                  <span className="font-mono text-[0.66rem] text-ardoise uppercase">
                    {l.match.tournament.nom} · Tour {l.match.tour}
                  </span>
                )}
                <p className="mt-1 text-sm text-encre">{l.motif}</p>
                <p className="mt-1 text-sm text-atteste">
                  Résolu par {l.resolu_par?.pseudo ?? "un administrateur"} : {l.resolution}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      </Reveal>
      </div>
    </main>
  );
}
