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
import { classeCarte, classeBoutonPrimaire, accentDepuisCouleur } from "@/lib/ui";
import Badge from "@/components/ui/Badge";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

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
    <main className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative">
      <Reveal>
        <span className="block font-mono text-[0.66rem] tracking-[0.22em] text-ardoise uppercase">
          League of Legends
        </span>
        <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
          Tournois
        </h1>
      </Reveal>

      <Reveal delai={0.1}>
      <form method="get" className={`mt-8 flex flex-wrap items-end gap-4 ${classeCarte("none")}`}>
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

        <button type="submit" className={classeBoutonPrimaire()}>
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
      </Reveal>

      <Reveal delai={0.15}>
      <div className="mt-8">
        {erreurConnexion ? (
          <p className={classeCarte("sceau") + " text-sm text-sceau"}>
            Impossible de charger les tournois pour l&apos;instant. Réessaie
            dans un instant.
          </p>
        ) : tournois.length === 0 ? (
          <p className={classeCarte("none") + " text-sm text-ardoise"}>
            Aucun tournoi ne correspond à ces critères pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tournois.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/lol/tournois/${t.slug}`}
                  className={`block ${classeCarte(accentDepuisCouleur(COULEUR_STATUT[t.statut as StatutPublic]), true)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-display text-lg font-extrabold tracking-tight text-encre">
                      {t.nom}
                    </span>
                    <Badge couleur={COULEUR_STATUT[t.statut as StatutPublic]}>
                      {LABEL_STATUT[t.statut as StatutPublic]}
                    </Badge>
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
      </Reveal>
      </div>
    </main>
  );
}
