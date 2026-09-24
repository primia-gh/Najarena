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
import { classeCarte, accentDepuisCouleur } from "@/lib/ui";
import Badge from "@/components/ui/Badge";
import Bouton from "@/components/ui/Bouton";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationBracketVide from "@/components/ui/IllustrationBracketVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

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

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug. La liste des tournois et celle des régions sont
  // indépendantes l'une de l'autre, lancées en parallèle plutôt qu'en série.
  let requete = supabase
    .from("tournaments")
    .select("id, slug, nom, format, capacite, region, statut, debute_le")
    .eq("game_id", 1)
    .in("statut", STATUTS_PUBLICS)
    .order("debute_le", { ascending: true })
    .limit(50);

  if (statutFiltre) requete = requete.eq("statut", statutFiltre);
  if (regionFiltre) requete = requete.eq("region", regionFiltre);

  const [{ data, error }, { data: regionsData }] = await Promise.all([
    requete,
    supabase.from("tournaments").select("region").eq("game_id", 1).in("statut", STATUTS_PUBLICS),
  ]);

  const tournois: Array<{
    id: string;
    slug: string;
    nom: string;
    format: string;
    capacite: number;
    region: string;
    statut: Statut;
    debute_le: string;
  }> = data ?? [];
  const erreurConnexion = Boolean(error);
  const regions = Array.from(new Set((regionsData ?? []).map((r) => r.region))).sort();

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-5xl px-gouttiere">
      <Apparition>
        <span className="block font-texte text-libelle font-medium text-muted uppercase">
          League of Legends
        </span>
        <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
          Tournois
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.78rem] text-muted">
          {STATUTS_PUBLICS.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full bg-current ${COULEUR_STATUT[s]}`} />
              {LABEL_STATUT[s]}
            </span>
          ))}
        </div>
      </Apparition>

      <Apparition delai={0.1}>
      <form method="get" className={`mt-8 flex flex-wrap items-end gap-4 ${classeCarte("none")}`}>
        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Statut
          </span>
          <select
            name="statut"
            defaultValue={statutFiltre ?? ""}
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Région
          </span>
          <select
            name="region"
            defaultValue={regionFiltre ?? ""}
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Toutes</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <Bouton>Filtrer</Bouton>

        {(statutFiltre || regionFiltre) && (
          <Link
            href="/lol/tournois"
            className="inline-flex min-h-11 items-center font-texte text-mini text-muted underline underline-offset-3 hover:text-text"
          >
            Réinitialiser
          </Link>
        )}
      </form>
      </Apparition>

      <Apparition delai={0.15}>
      <div className="mt-8">
        {erreurConnexion ? (
          <p className={classeCarte("sceau") + " text-sm text-danger"}>
            Impossible de charger les tournois pour l&apos;instant. Réessaie
            dans un instant.
          </p>
        ) : tournois.length === 0 ? (
          <EtatVide illustration={<IllustrationBracketVide />}>
            Aucun tournoi ne correspond à ces critères pour l&apos;instant.{" "}
            <Link href="/lol/tournois/demo" className="text-text underline underline-offset-3">
              Voir à quoi ressemble un tournoi Najarena
            </Link>
            .
          </EtatVide>
        ) : (
          <ul className="flex flex-col gap-3">
            {tournois.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/lol/tournois/${t.slug}`}
                  className={`block ${classeCarte(accentDepuisCouleur(COULEUR_STATUT[t.statut as StatutPublic]), true)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-titre uppercase text-lg font-extrabold tracking-tight text-text">
                      {t.nom}
                    </span>
                    <Badge couleur={COULEUR_STATUT[t.statut as StatutPublic]}>
                      {LABEL_STATUT[t.statut as StatutPublic]}
                    </Badge>
                  </div>
                  <div className="mt-2 font-texte tabular-nums text-[0.72rem] text-muted">
                    {t.format} · {t.capacite} joueurs · {t.region} ·{" "}
                    {formaterDate(t.debute_le)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      </Apparition>
      </div>
    </main>
  );
}
