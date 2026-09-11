import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LABEL_STATUT, COULEUR_STATUT, formaterDate, type StatutPublic } from "@/lib/tournois";

export const metadata: Metadata = {
  title: "League of Legends — Najarena",
  description:
    "Tournois League of Legends en 1v1, quotidiens, sur Najarena. Résultats lus dans la donnée officielle Riot, classement Glicko-2 vérifié.",
};

export default async function LolHubPage() {
  const supabase = await createClient();

  const { data: jeu } = await supabase.from("games").select("id").eq("slug", "lol").maybeSingle();

  let prochainsTournois: Array<{
    slug: string;
    nom: string;
    format: string;
    capacite: number;
    region: string;
    statut: StatutPublic;
    debute_le: string;
  }> = [];

  if (jeu) {
    const { data } = await supabase
      .from("tournaments")
      .select("slug, nom, format, capacite, region, statut, debute_le")
      .eq("game_id", jeu.id)
      .in("statut", ["ouvert", "checkin"])
      .order("debute_le", { ascending: true })
      .limit(4);
    prochainsTournois = (data ?? []) as typeof prochainsTournois;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      <span className="mt-6 block font-mono text-[0.66rem] tracking-[0.22em] text-ardoise uppercase">
        League of Legends
      </span>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre sm:text-5xl">
        Ton niveau, vérifié.
      </h1>
      <p className="mt-3 max-w-md text-sm text-ardoise">
        Des tournois 1v1 quotidiens. Les résultats sont lus dans la donnée
        officielle Riot — ton classement devient une preuve, pas une
        déclaration.
      </p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link
          href="/lol/tournois"
          className="rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
        >
          Voir les tournois
        </Link>
        <Link
          href="/lol/classement"
          className="rounded-[3px] border border-trait px-4 py-2 text-sm font-semibold text-encre transition hover:border-encre"
        >
          Voir le classement
        </Link>
      </div>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
            Prochains tournois
          </h2>
          <Link
            href="/lol/tournois"
            className="font-mono text-[0.7rem] text-ardoise underline underline-offset-3 hover:text-encre"
          >
            Tout voir
          </Link>
        </div>

        {prochainsTournois.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Aucun tournoi ouvert pour l&apos;instant.{" "}
            <Link href="/organiser/nouveau" className="text-encre underline underline-offset-3">
              Organiser le premier
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {prochainsTournois.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/lol/tournois/${t.slug}`}
                  className="block rounded-[3px] border border-trait bg-carte p-4 transition hover:border-encre"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-lg font-extrabold tracking-tight text-encre">
                      {t.nom}
                    </span>
                    <span
                      className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase ${COULEUR_STATUT[t.statut]}`}
                    >
                      {LABEL_STATUT[t.statut]}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-[0.72rem] text-ardoise">
                    {t.format} · {t.capacite} joueurs · {t.region} ·{" "}
                    {formaterDate(t.debute_le)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
