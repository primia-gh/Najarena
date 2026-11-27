import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  COLONNES_TOURNOI_LISTE,
  INSCRIPTIONS_ACTIVES,
  STATUTS_PUBLICS,
  estStatutPublic,
  grouperTournois,
  versTournoiListe,
  type StatutPublic,
  type TournoiListe,
} from "@/lib/tournois";
import Alerte from "@/components/design/Alerte";
import PuceFiltre from "@/components/design/PuceFiltre";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import EnTetePage from "@/components/design/EnTetePage";
import EtatVide from "@/components/design/EtatVide";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";
import LigneTournoi from "@/components/tournoi/LigneTournoi";

export const metadata: Metadata = {
  // Adresse canonique (audit M11) : sans ses paramètres de filtre ou de message.
  alternates: { canonical: "/lol/tournois" },
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
      .select(COLONNES_TOURNOI_LISTE)
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
    .flatMap((t) => {
      const ligne = versTournoiListe(t);
      return ligne ? [ligne] : [];
    });
  const groupes = grouperTournois(tournois);
  const regions = Array.from(new Set((regionsData ?? []).map((r) => r.region))).sort();
  const ordre = (["enDirect", "aVenir", "termines", "annules"] as const).filter((g) => groupes[g].length > 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <EnTetePage
          surtitre="League of Legends"
          titre="Tournois"
          illustration="enteteTournois"
          intro="Des tournois 1v1 chaque jour et des tournois 5v5 entre équipes. Les résultats sont lus dans la donnée officielle de Riot : personne ne déclare son score."
          actions={
            <>
              <Link
                href="/lol/a-la-demande"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-text underline underline-offset-3 hover:decoration-text hover:decoration-2"
              >
                Pas de tournoi à ton heure ? Indique quand tu es libre
              </Link>
              <Link
                href="/lol/divisions"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-text underline underline-offset-3 hover:decoration-text hover:decoration-2"
              >
                Divisions : un match par semaine, à ton niveau
              </Link>
            </>
          }
          aside={
            <BoutonLien href="/organiser/nouveau" variante="contour">
              Organiser un tournoi
            </BoutonLien>
          }
        />

        <Apparition delai={0.08} className="flex flex-col gap-3">
          <nav aria-label="Filtrer par statut" className="flex gap-2 overflow-x-auto pb-1">
            {FILTRES.map((f) => (
              <PuceFiltre key={f.libelle} href={lien(f.statut, regionFiltre)} actif={(statutFiltre ?? null) === f.statut}>
                {f.libelle}
              </PuceFiltre>
            ))}
          </nav>
          {regions.length > 1 && (
            <nav aria-label="Filtrer par région" className="flex flex-wrap items-center gap-2">
              <span className="mr-2 font-texte text-mini font-medium text-faint uppercase">Région</span>
              <PuceFiltre href={lien(statutFiltre ?? null, undefined)} actif={!regionFiltre}>
                Toutes
              </PuceFiltre>
              {regions.map((r) => (
                <PuceFiltre key={r} href={lien(statutFiltre ?? null, r)} actif={regionFiltre === r}>
                  {r}
                </PuceFiltre>
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
            <EtatVide illustration="videTournoi"
              titre={statutFiltre || regionFiltre ? "Aucun tournoi ne correspond." : "Aucun tournoi ouvert pour l'instant."}
              actions={
                <>
                  <BoutonLien href="/lol/tournois/demo" variante="secondaire">
                    Voir le tournoi d&apos;exemple
                  </BoutonLien>
                  <BoutonLien href="/organiser/nouveau" variante="secondaire">
                    Organiser un tournoi
                  </BoutonLien>
                </>
              }
            >
              Découvre à quoi ressemble un tournoi Najarena avec le tournoi d&apos;exemple, ou lance le tien.
            </EtatVide>
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
              <Link href={lien("termine", regionFiltre)} className="text-text underline underline-offset-3 hover:decoration-text hover:decoration-2">
                Voir tous les tournois terminés
              </Link>
            </p>
          )}
        </Apparition>
      </div>
    </main>
  );
}
