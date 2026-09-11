import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Statut } from "@/lib/tournois";
import {
  STATUTS_PUBLICS,
  LABEL_STATUT,
  COULEUR_STATUT,
  estStatutPublic,
  formaterDate,
  type StatutPublic,
} from "@/lib/tournois";

export const metadata: Metadata = {
  title: "Tournois LoL — Najarena",
  description:
    "Tous les tournois League of Legends en 1v1 sur Najarena : à venir, en cours et terminés. Résultats lus dans la donnée officielle Riot.",
};

interface TournoisPageProps {
  searchParams: Promise<{ statut?: string; region?: string }>;
}

export default async function TournoisPage({ searchParams }: TournoisPageProps) {
  const params = await searchParams;
  const statutFiltre = estStatutPublic(params.statut) ? params.statut : undefined;
  const regionFiltre = params.region || undefined;

  const supabase = await createClient();

  const { data: jeu } = await supabase
    .from("games")
    .select("id")
    .eq("slug", "lol")
    .single();

  let tournois: Array<{
    id: string;
    slug: string;
    nom: string;
    format: string;
    capacite: number;
    region: string;
    statut: Statut;
    debute_le: string;
  }> = [];
  let regions: string[] = [];
  let erreurConnexion = false;

  if (jeu) {
    let requete = supabase
      .from("tournaments")
      .select("id, slug, nom, format, capacite, region, statut, debute_le")
      .eq("game_id", jeu.id)
      .in("statut", STATUTS_PUBLICS)
      .order("debute_le", { ascending: true })
      .limit(50);

    if (statutFiltre) requete = requete.eq("statut", statutFiltre);
    if (regionFiltre) requete = requete.eq("region", regionFiltre);

    const { data, error } = await requete;
    tournois = data ?? [];
    if (error) erreurConnexion = true;

    const { data: regionsData } = await supabase
      .from("tournaments")
      .select("region")
      .eq("game_id", jeu.id)
      .in("statut", STATUTS_PUBLICS);
    regions = Array.from(new Set((regionsData ?? []).map((r) => r.region))).sort();
  } else {
    erreurConnexion = true;
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
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
        Tournois
      </h1>

      <form
        method="get"
        className="mt-8 flex flex-wrap items-end gap-4 rounded-[3px] border border-trait bg-carte p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Statut
          </span>
          <select
            name="statut"
            defaultValue={statutFiltre ?? ""}
            className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre"
          >
            <option value="">Tous</option>
            {STATUTS_PUBLICS.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUT[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Région
          </span>
          <select
            name="region"
            defaultValue={regionFiltre ?? ""}
            className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre"
          >
            <option value="">Toutes</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier hover:brightness-110"
        >
          Filtrer
        </button>

        {(statutFiltre || regionFiltre) && (
          <Link
            href="/lol/tournois"
            className="font-mono text-[0.7rem] text-ardoise underline underline-offset-3 hover:text-encre"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="mt-8">
        {erreurConnexion ? (
          <p className="rounded-[3px] border border-sceau/30 bg-sceau/10 p-6 text-sm text-sceau">
            Impossible de charger les tournois pour l&apos;instant. Réessaie
            dans un instant.
          </p>
        ) : tournois.length === 0 ? (
          <p className="rounded-[3px] border border-trait bg-carte p-6 text-sm text-ardoise">
            Aucun tournoi ne correspond à ces critères pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tournois.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/lol/tournois/${t.slug}`}
                  className="block rounded-[3px] border border-trait bg-carte p-4 transition hover:border-encre"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-lg font-extrabold tracking-tight text-encre">
                      {t.nom}
                    </span>
                    <span
                      className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase ${COULEUR_STATUT[t.statut as StatutPublic]}`}
                    >
                      {LABEL_STATUT[t.statut as StatutPublic]}
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
      </div>
    </main>
  );
}
