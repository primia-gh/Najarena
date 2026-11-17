import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre, ORDRE_OFFRE } from "@/lib/offres";
import {
  choisirFormat,
  COLONNES_INDICATEURS,
  COLONNES_INDICATEURS_CLASSEES,
  construireBilan,
  construireBuild,
  LIBELLE_POSTE,
  partieClasseeDepuisLigne,
  partieDepuisLigne,
  posteCompare,
  repereDepuisLigne,
  type BuildChampion,
  type FormatBilan,
  type LigneReperesBuild,
} from "@/lib/bilan";
import { estPalierRiot, LIBELLE_PALIER_RIOT, libelleRang } from "@/lib/analyse-classees";
import { positionsNiveau } from "@/lib/niveau-classees";
import { sangFroid } from "@/lib/sang-froid";
import { hygieneDeJeu } from "@/lib/hygiene-jeu";
import { carteDesMorts } from "@/lib/carte-morts";
import { chargerDonneesJeu, estObjetDeBuild } from "@/lib/ddragon";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import Panneau from "@/components/design/Panneau";
import VueBilan, { MethodeBilan, type ExtrasClassees } from "@/components/bilan/VueBilan";
import ReglagesAnalyse, { type EtatReglages } from "@/components/bilan/ReglagesAnalyse";

// Mon bilan (05/10/2026) : forces, axes de travail, plan, progression,
// champions et builds, calculés sur les parties vérifiées du joueur
// (src/lib/bilan.ts). Visible de lui seul. Bilan express gratuit, bilan
// complet avec l'offre Elite. Étape 2 : onglet « Classées » pour les
// parties classées lues chez Riot avec son accord (niveau, hygiène de jeu,
// carte des morts, sang-froid) et réglages de l'analyse.

export const metadata: Metadata = {
  title: "Mon bilan — Najarena",
  robots: { index: false, follow: false },
};

interface BilanPageProps {
  searchParams: Promise<{ format?: string; message?: string; erreur?: string }>;
}

const NOM_ONGLET: Record<FormatBilan, string> = { "1v1": "1v1", "5v5": "5v5", classees: "Classées" };

export default async function BilanPage({ searchParams }: BilanPageProps) {
  const { format: formatDemande, message, erreur } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Fmoi%2Fbilan");
  const moi = userData.user.id;

  const [{ data: lignes }, { offre }, { data: reglages }, { data: lignesClassees }, { count: enAttente }, { data: compte }] =
    await Promise.all([
      supabase
        .from("indicateurs_partie")
        .select(COLONNES_INDICATEURS)
        .eq("profile_id", moi)
        .order("joue_le", { ascending: true })
        .limit(1000),
      chargerOffre(supabase, moi),
      supabase
        .from("analyse_reglages")
        .select("classees, classees_depuis, bilan_hebdo, derniere_synchro, palier, division, points_ligue")
        .eq("profile_id", moi)
        .maybeSingle(),
      supabase
        .from("indicateurs_classees")
        .select(COLONNES_INDICATEURS_CLASSEES)
        .eq("profile_id", moi)
        .order("joue_le", { ascending: true })
        .limit(100),
      supabase
        .from("parties_classees")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", moi)
        .in("etat", ["a_lire", "lue"]),
      supabase
        .from("game_accounts")
        .select("verifie_le")
        .eq("profile_id", moi)
        .eq("game_id", 1)
        .eq("est_principal", true)
        .maybeSingle(),
    ]);
  const partiesTournoi = (lignes ?? []).flatMap((l) => {
    const p = partieDepuisLigne(l);
    return p ? [p] : [];
  });
  const classees = lignesClassees ?? [];
  const partiesClassees = classees.map(partieClasseeDepuisLigne);
  const toutes = [...partiesTournoi, ...partiesClassees];
  const complet = ORDRE_OFFRE[offre] >= ORDRE_OFFRE.elite;
  const nombre = (f: FormatBilan) => toutes.filter((p) => p.format === f).length;
  const format: FormatBilan = formatDemande === "classees" ? "classees" : choisirFormat(toutes, formatDemande);

  const etat: EtatReglages = {
    classees: reglages?.classees ?? false,
    classeesDepuis: reglages?.classees_depuis ?? null,
    bilanHebdo: reglages?.bilan_hebdo ?? false,
    derniereSynchro: reglages?.derniere_synchro ?? null,
    palier: reglages?.palier ?? null,
    division: reglages?.division ?? null,
    pointsLigue: reglages?.points_ligue ?? null,
  };
  const discordLie =
    (userData.user.identities ?? []).some((i) => i.provider === "discord") ||
    (userData.user.app_metadata?.providers as string[] | undefined)?.includes("discord") === true;
  const reglagesAnalyse = (
    <ReglagesAnalyse
      etat={etat}
      compteVerifie={Boolean(compte?.verifie_le)}
      elite={complet}
      discordLie={discordLie}
      partiesLues={classees.length}
      enAttente={enAttente ?? 0}
      format={format}
    />
  );

  const onglets = (["1v1", "5v5"] as const).filter((f) => nombre(f) > 0);
  const navigation = (
    <nav aria-label="Parties analysées" className="flex flex-wrap gap-2">
      {[...onglets, "classees" as const].map((f) => (
        <Link
          key={f}
          href={`/moi/bilan?format=${f}`}
          aria-current={f === format ? "page" : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-bouton border px-4 font-texte text-sm font-semibold tracking-[2px] uppercase ${
            f === format ? "border-accent text-accent" : "border-line-strong text-muted hover:text-text"
          }`}
        >
          {NOM_ONGLET[f]}
          <span className="font-medium text-faint tabular-nums">{nombre(f)}</span>
        </Link>
      ))}
    </nav>
  );

  const enTete = (
    <Apparition>
      <Link
        href="/moi"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        ← Mon compte
      </Link>
      <h1 className="mt-6 font-titre text-section font-black tracking-[1px] uppercase">Mon bilan</h1>
      <p className="mt-3 max-w-3xl text-courant text-text-2">
        Ce que disent tes parties vérifiées : tes forces, ce qui te coûte des victoires, et quoi travailler. Chaque
        constat donne ses chiffres et le nombre de parties sur lequel il repose. Visible de toi seul.
      </p>
    </Apparition>
  );

  const retours = (
    <>
      {erreur && (
        <p role="alert" className="rounded-bouton border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {erreur}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-bouton border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {message}
        </p>
      )}
    </>
  );

  const page = (contenu: ReactNode) => (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        {enTete}
        {retours}
        {navigation}
        {contenu}
      </div>
    </main>
  );

  // Parties classées pas encore lues : accord à donner, ou première lecture en cours.
  if (format === "classees" && partiesClassees.length === 0) {
    return page(
      <>
        {etat.classees && (
          <Panneau className="flex flex-col gap-3 p-6 sm:p-8">
            <h2 className="font-titre text-3xl font-black uppercase">Première lecture en cours</h2>
            <p className="text-text-2 tabular-nums">
              Tes parties classées sont lues chez Riot par petits lots, quelques minutes à chaque fois
              {(enAttente ?? 0) > 0 ? ` : ${enAttente} en attente` : ""}. Reviens dans un moment.
            </p>
          </Panneau>
        )}
        {reglagesAnalyse}
        <BoutonLien href="/lol/bilan?format=classees" variante="secondaire">
          Voir un bilan de classées d&apos;exemple
        </BoutonLien>
        <MethodeBilan />
      </>,
    );
  }

  // Aucune partie vérifiée de tournoi.
  if (format !== "classees" && partiesTournoi.length === 0) {
    return page(
      <>
        <section className="flex max-w-3xl flex-col gap-4">
          <h2 className="font-titre text-3xl font-black uppercase">Pas encore de partie vérifiée</h2>
          <p className="text-text-2">
            Ton bilan se construit avec les parties dont le résultat a été lu chez Riot : tournois, arène et défis. Lie
            ton Riot ID si ce n&apos;est pas fait, puis joue : il faut 5 parties vérifiées pour un premier bilan. Tu peux
            aussi faire analyser tes parties classées (onglet « Classées »).
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <BoutonLien href="/lol/tournois">Voir les tournois</BoutonLien>
            <BoutonLien href="/lol/bilan" variante="secondaire">
              Voir un bilan d&apos;exemple
            </BoutonLien>
          </div>
        </section>
        {reglagesAnalyse}
        <MethodeBilan />
      </>,
    );
  }

  const partiesDuFormat = toutes.filter((p) => p.format === format);
  // En 5v5 et en classée, les repères sont ceux du poste principal ; sans poste connu, pas de comparaison.
  const poste = format === "1v1" ? null : posteCompare(partiesDuFormat);
  const palier = format === "classees" && estPalierRiot(etat.palier) ? etat.palier : null;
  const sansRepere = format !== "1v1" && !poste;
  const [{ data: lignesReperes }, { data: lignesPositions }, donnees] = await Promise.all([
    sansRepere
      ? Promise.resolve({ data: [] })
      : format === "classees"
        ? supabase.rpc("reperes_classees", { p_palier: palier ?? undefined, p_poste: poste ?? undefined })
        : supabase.rpc("reperes_bilan", { p_format: format, p_poste: poste ?? undefined, p_sauf: moi }),
    format === "classees" && complet && poste
      ? supabase.rpc("percentiles_classees", { p_palier: palier ?? undefined, p_poste: poste })
      : Promise.resolve({ data: [] }),
    chargerDonneesJeu(),
  ]);
  const reperes = (lignesReperes ?? []).flatMap((l) => {
    const r = repereDepuisLigne(l);
    return r ? [r] : [];
  });
  const bilan = construireBilan(toutes, format, reperes);

  let builds: BuildChampion[] = [];
  if (complet) {
    const principaux = bilan.champions.slice(0, 3);
    const references: { data: LigneReperesBuild[] | null }[] = await Promise.all(
      principaux.map((c) =>
        format === "classees"
          ? supabase.rpc("reperes_build_classees", { p_champion: c.champion })
          : supabase.rpc("reperes_build", { p_format: format, p_champion: c.champion, p_sauf: moi }),
      ),
    );
    builds = principaux.map((c, i) =>
      construireBuild(partiesDuFormat, c.champion, references[i].data ?? [], (o) => estObjetDeBuild(donnees, o)),
    );
  }

  let extras: ExtrasClassees | undefined;
  if (format === "classees") {
    extras = {
      rang: libelleRang(etat.palier, etat.division, etat.pointsLigue),
      groupe: poste
        ? `joueurs ${palier ? LIBELLE_PALIER_RIOT[palier] : "de tous rangs"} au poste ${LIBELLE_POSTE[poste] ?? poste}`
        : null,
      niveau: positionsNiveau(lignesPositions ?? []),
      sangFroid: complet ? sangFroid(partiesTournoi.filter((p) => p.format === "5v5"), partiesClassees) : null,
      hygiene: complet
        ? hygieneDeJeu(classees.map((c) => ({ joueLe: c.joue_le, dureeSecondes: c.duree_secondes, gagne: c.gagne })))
        : null,
      carte: complet ? carteDesMorts(classees) : null,
    };
  }

  return page(
    <>
      <VueBilan bilan={bilan} builds={builds} donnees={donnees} complet={complet} extras={extras} />
      {reglagesAnalyse}
    </>,
  );
}
