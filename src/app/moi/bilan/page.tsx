import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre, ORDRE_OFFRE } from "@/lib/offres";
import {
  choisirFormat,
  COLONNES_INDICATEURS,
  construireBilan,
  construireBuild,
  posteCompare,
  partieDepuisLigne,
  repereDepuisLigne,
  type BuildChampion,
  type FormatBilan,
} from "@/lib/bilan";
import { chargerDonneesJeu, estObjetDeBuild } from "@/lib/ddragon";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import VueBilan, { MethodeBilan } from "@/components/bilan/VueBilan";

// Mon bilan (05/10/2026, étape 1) : forces, axes de travail, plan,
// progression, champions et builds, calculés sur les parties vérifiées du
// joueur (src/lib/bilan.ts). Visible de lui seul. Bilan express gratuit,
// bilan complet avec l'offre Elite.

export const metadata: Metadata = {
  title: "Mon bilan — Najarena",
  robots: { index: false, follow: false },
};

interface BilanPageProps {
  searchParams: Promise<{ format?: string }>;
}

export default async function BilanPage({ searchParams }: BilanPageProps) {
  const { format: formatDemande } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Fmoi%2Fbilan");
  const moi = userData.user.id;

  const [{ data: lignes }, { offre }] = await Promise.all([
    supabase
      .from("indicateurs_partie")
      .select(COLONNES_INDICATEURS)
      .eq("profile_id", moi)
      .order("joue_le", { ascending: true })
      .limit(1000),
    chargerOffre(supabase, moi),
  ]);
  const parties = (lignes ?? []).flatMap((l) => {
    const p = partieDepuisLigne(l);
    return p ? [p] : [];
  });
  const complet = ORDRE_OFFRE[offre] >= ORDRE_OFFRE.elite;
  const nombre = (f: FormatBilan) => parties.filter((p) => p.format === f).length;

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

  if (parties.length === 0) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
        <FondEcailles />
        <div className="relative flex flex-col gap-10 px-grille *:max-w-3xl">
          {enTete}
          <section className="flex flex-col gap-4">
            <h2 className="font-titre text-3xl font-black uppercase">Pas encore de partie vérifiée</h2>
            <p className="text-text-2">
              Ton bilan se construit avec les parties dont le résultat a été lu chez Riot : tournois, arène et défis.
              Lie ton Riot ID si ce n&apos;est pas fait, puis joue : il faut 5 parties vérifiées pour un premier bilan.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <BoutonLien href="/lol/tournois">Voir les tournois</BoutonLien>
              <BoutonLien href="/lier-riot" variante="secondaire">
                Lier mon Riot ID
              </BoutonLien>
              <BoutonLien href="/lol/bilan" variante="secondaire">
                Voir un bilan d&apos;exemple
              </BoutonLien>
            </div>
          </section>
          <MethodeBilan />
        </div>
      </main>
    );
  }

  const format = choisirFormat(parties, formatDemande);
  const partiesDuFormat = parties.filter((p) => p.format === format);
  // En 5v5, les repères sont ceux du poste principal ; sans poste connu, pas de comparaison.
  const poste = format === "5v5" ? posteCompare(partiesDuFormat) : null;
  const sansRepere = format === "5v5" && !poste;
  const [{ data: lignesReperes }, donnees] = await Promise.all([
    sansRepere
      ? Promise.resolve({ data: [] })
      : supabase.rpc("reperes_bilan", { p_format: format, p_poste: poste ?? undefined, p_sauf: moi }),
    chargerDonneesJeu(),
  ]);
  const reperes = (lignesReperes ?? []).flatMap((l) => {
    const r = repereDepuisLigne(l);
    return r ? [r] : [];
  });
  const bilan = construireBilan(parties, format, reperes);

  let builds: BuildChampion[] = [];
  if (complet) {
    const principaux = bilan.champions.slice(0, 3);
    const references = await Promise.all(
      principaux.map((c) => supabase.rpc("reperes_build", { p_format: format, p_champion: c.champion, p_sauf: moi })),
    );
    builds = principaux.map((c, i) =>
      construireBuild(partiesDuFormat, c.champion, references[i].data ?? [], (o) => estObjetDeBuild(donnees, o)),
    );
  }

  const formats = (["1v1", "5v5"] as const).filter((f) => nombre(f) > 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        {enTete}
        {formats.length > 1 && (
          <nav aria-label="Format du bilan" className="flex flex-wrap gap-2">
            {formats.map((f) => (
              <Link
                key={f}
                href={`/moi/bilan?format=${f}`}
                aria-current={f === format ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-bouton border px-4 font-texte text-sm font-semibold tracking-[2px] uppercase ${
                  f === format ? "border-accent text-accent" : "border-line-strong text-muted hover:text-text"
                }`}
              >
                {f}
                <span className="font-medium text-faint tabular-nums">{nombre(f)}</span>
              </Link>
            ))}
          </nav>
        )}
        <VueBilan bilan={bilan} builds={builds} donnees={donnees} complet={complet} />
      </div>
    </main>
  );
}
