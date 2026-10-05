import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { STATUTS_PUBLICS, estStatutPublic, grouperTournois, type StatutPublic } from "@/lib/tournois";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import LigneTournoi, { type TournoiListe } from "@/components/tournoi/LigneTournoi";

export const metadata: Metadata = {
  title: "Tournois LoL — Najarena",
  description:
    "Tous les tournois League of Legends en 1v1 et en 5v5 sur Najarena : à venir, en cours et terminés. Résultats lus dans la donnée officielle Riot.",
};

interface TournoisPageProps {
  searchParams: Promise<{ statut?: string; region?: string }>;
}

// Revue visuelle du 05/10/2026 : la liste suivait la date de début du plus
// ancien au plus récent — un tournoi annulé il y a trois jours passait
// avant celui où l'on peut s'inscrire ce soir. Désormais, sans filtre : en
// direct, puis à venir (le plus proche d'abord), puis les derniers
// terminés ; les annulés ne s'affichent qu'avec leur filtre. Filtres en
// liens (pas de bouton « Filtrer » à valider).

const COLONNES =
  "id, slug, nom, format, capacite, region, statut, debute_le, reserve_membres, creneau_auto, compte_pour_classement, classe, registrations(count)";
const INSCRIPTIONS_ACTIVES = ["inscrit", "confirme"] as const;

const FILTRES: { statut: StatutPublic | null; libelle: string }[] = [
  { statut: null, libelle: "Tous" },
  { statut: "ouvert", libelle: "Inscriptions ouvertes" },
  { statut: "checkin", libelle: "Check-in" },
  { statut: "en_cours", libelle: "En cours" },
  { statut: "termine", libelle: "Terminés" },
  { statut: "annule", libelle: "Annulés" },
];

const TITRES: Record<"enDirect" | "aVenir" | "termines" | "annules", string> = {
  enDirect: "En direct",
  aVenir: "À venir",
  termines: "Terminés",
  annules: "Annulés",
};

function lien(statut: StatutPublic | null, region: string | undefined) {
  const p = new URLSearchParams();
  if (statut) p.set("statut", statut);
  if (region) p.set("region", region);
  const q = p.toString();
  return q ? `/lol/tournois?${q}` : "/lol/tournois";
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-bouton border px-4 font-texte text-[13px] font-semibold tracking-[2px] whitespace-nowrap uppercase transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
        actif ? "border-text text-text" : "border-line-strong text-muted hover:border-[rgba(245,245,244,0.25)] hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function TournoisPage({ searchParams }: TournoisPageProps) {
  const params = await searchParams;
  const statutFiltre = estStatutPublic(params.statut) ? params.statut : undefined;
  const regionFiltre = params.region || undefined;

  const supabase = await createClient();

  // game_id=1 est LoL — seule ligne de `games` en V1. Défis entre joueurs et
  // scrims (nature ≠ 'tournoi') : pas des tournois à rejoindre.
  const base = () => {
    let r = supabase
      .from("tournaments")
      .select(COLONNES)
      .eq("game_id", 1)
      .eq("nature", "tournoi")
      .in("registrations.statut", [...INSCRIPTIONS_ACTIVES]);
    if (regionFiltre) r = r.eq("region", regionFiltre);
    return r;
  };

  const requetes = statutFiltre
    ? [
        base()
          .eq("statut", statutFiltre)
          .order("debute_le", { ascending: statutFiltre !== "termine" && statutFiltre !== "annule" })
          .limit(50),
      ]
    : [
        base().in("statut", ["ouvert", "checkin", "en_cours"]).order("debute_le", { ascending: true }).limit(40),
        base().eq("statut", "termine").order("debute_le", { ascending: false }).limit(12),
      ];

  const [resultats, { data: regionsData }] = await Promise.all([
    Promise.all(requetes),
    supabase.from("tournaments").select("region").eq("game_id", 1).eq("nature", "tournoi").in("statut", STATUTS_PUBLICS),
  ]);

  const erreurConnexion = resultats.some((r) => r.error);
  const tournois: TournoiListe[] = resultats
    .flatMap((r) => r.data ?? [])
    .filter((t): t is typeof t & { statut: StatutPublic } => estStatutPublic(t.statut))
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      nom: t.nom,
      format: t.format,
      capacite: t.capacite,
      region: t.region,
      statut: t.statut,
      debute_le: t.debute_le,
      reserve_membres: t.reserve_membres,
      officiel: t.creneau_auto !== null,
      amical: t.compte_pour_classement === false,
      classe: t.classe,
      inscrits: t.registrations[0]?.count ?? 0,
    }));
  const groupes = grouperTournois(tournois);
  const regions = Array.from(new Set((regionsData ?? []).map((r) => r.region))).sort();
  const ordre = (["enDirect", "aVenir", "termines", "annules"] as const).filter((g) => groupes[g].length > 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <LibelleSection>League of Legends</LibelleSection>
            <h1 className="mt-4 font-titre text-section font-black tracking-[1px] uppercase">Tournois</h1>
            <p className="mt-5 max-w-2xl text-courant text-text-2">
              Des tournois 1v1 chaque jour et des tournois 5v5 entre équipes. Les résultats sont lus dans la donnée
              officielle de Riot : personne ne déclare son score.
            </p>
          </div>
          <BoutonLien href="/organiser/nouveau" variante="contour">
            Organiser un tournoi
          </BoutonLien>
        </Apparition>

        <Apparition delai={0.08} className="flex flex-col gap-3">
          <nav aria-label="Filtrer par statut" className="flex gap-2 overflow-x-auto pb-1">
            {FILTRES.map((f) => (
              <Puce key={f.libelle} href={lien(f.statut, regionFiltre)} actif={(statutFiltre ?? null) === f.statut}>
                {f.libelle}
              </Puce>
            ))}
          </nav>
          {regions.length > 1 && (
            <nav aria-label="Filtrer par région" className="flex flex-wrap items-center gap-2">
              <span className="mr-2 font-texte text-mini font-medium text-faint uppercase">Région</span>
              <Puce href={lien(statutFiltre ?? null, undefined)} actif={!regionFiltre}>
                Toutes
              </Puce>
              {regions.map((r) => (
                <Puce key={r} href={lien(statutFiltre ?? null, r)} actif={regionFiltre === r}>
                  {r}
                </Puce>
              ))}
            </nav>
          )}
        </Apparition>

        <Apparition delai={0.12} className="flex flex-col gap-14">
          {erreurConnexion ? (
            <Alerte type="erreur" className="max-w-2xl">
              Impossible de charger les tournois pour l&apos;instant. Réessaie dans un instant.
            </Alerte>
          ) : ordre.length === 0 ? (
            <Panneau reperes className="flex flex-col items-start gap-5 p-8 sm:p-10">
              <p className="font-titre text-sous-titre font-black uppercase">
                {statutFiltre || regionFiltre ? "Aucun tournoi ne correspond." : "Aucun tournoi ouvert pour l'instant."}
              </p>
              <p className="max-w-xl text-text-2">
                Découvre à quoi ressemble un tournoi Najarena avec le tournoi d&apos;exemple, ou lance le tien.
              </p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <BoutonLien href="/lol/tournois/demo" variante="secondaire">
                  Voir le tournoi d&apos;exemple
                </BoutonLien>
                <BoutonLien href="/organiser/nouveau" variante="secondaire">
                  Organiser un tournoi
                </BoutonLien>
              </div>
            </Panneau>
          ) : (
            ordre.map((g) => (
              <section key={g} aria-labelledby={`tournois-${g}`} className="flex flex-col">
                <LibelleSection as="h2" id={`tournois-${g}`} className="border-b border-line-strong pb-4">
                  {TITRES[g]} <span className="text-faint tabular-nums">· {groupes[g].length}</span>
                </LibelleSection>
                <ul>
                  {groupes[g].map((t) => (
                    <li key={t.id}>
                      <LigneTournoi t={t} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          {!statutFiltre && groupes.termines.length >= 12 && (
            <p className="text-sm text-muted">
              Les 12 derniers tournois terminés.{" "}
              <Link href={lien("termine", regionFiltre)} className="text-text underline underline-offset-3 hover:text-accent">
                Voir tous les tournois terminés
              </Link>
            </p>
          )}
        </Apparition>
      </div>
    </main>
  );
}
