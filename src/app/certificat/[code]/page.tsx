import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir, calibrationPct } from "@/lib/classement";
import { FUSEAU_PARIS } from "@/lib/tournois-auto/creneaux";
import { URL_SITE } from "@/lib/notifications";
import { classeCarte } from "@/lib/ui";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import IndicateurConfiance from "@/components/design/IndicateurConfiance";
import BoutonCopier from "@/components/design/BoutonCopier";
import QrCode from "@/components/design/QrCode";

// Certificat de niveau vérifiable (28/09/2026, audit N9) : instantané daté,
// figé par la base et adossé au registre des points scellé. Page non
// indexée (lien envoyé à un recruteur, une équipe, un sponsor).

interface CertificatPageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}

const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSEAU_PARIS,
});

const chargerCertificat = cache(async (code: string) => {
  const supabase = await createClient();
  const { data: certificat } = await supabase.rpc("lire_certificat", { p_code: code }).maybeSingle();
  if (!certificat) return null;

  const [{ data: saison }, { data: ligne }] = await Promise.all([
    supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
    certificat.registre_numero !== null
      ? supabase.from("rating_events").select("empreinte").eq("numero", certificat.registre_numero).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const { data: actuel } =
    saison && !certificat.compte_supprime
      ? await supabase
          .from("ratings")
          .select("rating, rd, est_classe")
          .eq("profile_id", certificat.profile_id)
          .eq("game_id", 1)
          .eq("season_id", saison.id)
          .maybeSingle()
      : { data: null };

  return {
    certificat,
    actuel,
    registreConcorde: ligne ? ligne.empreinte === certificat.registre_empreinte : null,
  };
});

export async function generateMetadata({ params }: CertificatPageProps): Promise<Metadata> {
  const { code } = await params;
  const donnees = await chargerCertificat(code);
  if (!donnees) return { title: "Certificat introuvable — Najarena", robots: { index: false, follow: false } };
  const { certificat: c } = donnees;
  return {
    title: `Certificat de niveau de ${c.pseudo} — Najarena`,
    description: `Au ${DATE_HEURE.format(new Date(c.cree_le))} : rating ${arrondir(c.rating)}${c.palier ? ` (${c.palier})` : ""}, ${c.matchs_verifies} matchs vérifiés dans la donnée officielle Riot.`,
    robots: { index: false, follow: false },
  };
}

export default async function CertificatPage({ params, searchParams }: CertificatPageProps) {
  const { code } = await params;
  const { nouveau } = await searchParams;
  const donnees = await chargerCertificat(code);
  if (!donnees) notFound();

  const { certificat: c, actuel, registreConcorde } = donnees;
  const lien = `${URL_SITE}/certificat/${c.code}`;
  const defaites = c.matchs_verifies - c.victoires;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille *:max-w-3xl">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">Certificat de niveau</span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            {c.compte_supprime ? "Compte supprimé" : c.pseudo}
          </h1>
          <p className="mt-2 text-sm text-text-2">
            Émis le <span className="tabular-nums">{DATE_HEURE.format(new Date(c.cree_le))}</span>
            {c.saison ? ` · ${c.saison}` : ""} · League of Legends. Calculé par Najarena à partir des seuls résultats
            vérifiés, figé depuis : il ne peut plus être modifié.
          </p>

          {nouveau && (
            <div role="status" className={"mt-6 flex flex-wrap items-center gap-3 " + classeCarte("atteste")}>
              <span className="text-sm text-accent">Certificat émis. Envoie ce lien :</span>
              <code className="text-xs break-all text-text">{lien}</code>
              <BoutonCopier
                texte={lien}
                libelle="Copier le lien"
                className="inline-flex min-h-11 items-center text-mini font-semibold text-accent uppercase underline underline-offset-3"
              />
            </div>
          )}
        </Apparition>

        <Apparition delai={0.08}>
          <Panneau as="section" className="mt-8 flex flex-col gap-5 px-6 py-6 sm:px-8">
            <LibelleSection as="h2">À la date du certificat</LibelleSection>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-mini text-muted uppercase">Rating</span>
                <span className="font-titre text-6xl leading-none font-black tabular-nums">{arrondir(c.rating)}</span>
              </div>
              <IndicateurConfiance estClasse={c.est_classe} pct={calibrationPct(c.rd)} />
              <div className="flex flex-col gap-1">
                <span className="text-mini text-muted uppercase">Palier</span>
                <span className="text-lg font-semibold">{c.palier ?? "Non classé"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-mini text-muted uppercase">Matchs vérifiés</span>
                <span className="text-lg font-semibold tabular-nums">
                  {c.matchs_verifies} <span className="text-sm font-normal text-text-2">({c.victoires} V · {defaites} D)</span>
                </span>
              </div>
            </div>
            <p className="text-xs text-muted tabular-nums">
              RD {arrondir(c.rd)} — plus il est bas, plus le niveau est sûr (classé à partir de 150).
            </p>
          </Panneau>
        </Apparition>

        <Apparition delai={0.12}>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Panneau as="section" className="flex flex-col gap-2 px-6 py-6">
              <LibelleSection as="h2">Aujourd&apos;hui</LibelleSection>
              {c.compte_supprime ? (
                <p className="text-sm text-muted">Ce joueur a supprimé son compte depuis.</p>
              ) : actuel ? (
                <p className="text-sm text-text-2">
                  Rating <span className="font-semibold text-text tabular-nums">{arrondir(actuel.rating)}</span>{" "}
                  ({actuel.est_classe ? "classé" : "provisoire"}).{" "}
                  <Link href={`/joueur/${c.slug}`} className="text-text underline underline-offset-3 hover:text-accent">
                    Voir le CV à jour
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Pas encore de rating cette saison.{" "}
                  <Link href={`/joueur/${c.slug}`} className="text-text underline underline-offset-3 hover:text-accent">
                    Voir le CV
                  </Link>
                </p>
              )}
            </Panneau>

            <Panneau as="section" className="flex flex-col gap-2 px-6 py-6">
              <LibelleSection as="h2">Preuve</LibelleSection>
              {c.registre_numero !== null ? (
                <p className="text-sm text-text-2">
                  Adossé au{" "}
                  <Link href="/registre" className="text-text underline underline-offset-3 hover:text-accent">
                    registre des points
                  </Link>{" "}
                  à la ligne <span className="tabular-nums">{c.registre_numero}</span> :{" "}
                  {registreConcorde ? (
                    <span className="font-semibold text-accent uppercase">concorde</span>
                  ) : (
                    <span className="font-semibold text-danger uppercase">ne concorde plus</span>
                  )}{" "}
                  avec le registre actuel.
                </p>
              ) : (
                <p className="text-sm text-muted">Émis avant la première ligne du registre des points.</p>
              )}
              {c.registre_empreinte && (
                <code className="text-xs break-all text-muted tabular-nums">{c.registre_empreinte}</code>
              )}
            </Panneau>
          </div>
        </Apparition>

        {/* QR code (audit N9) : à imprimer sur un CV papier ou à montrer. */}
        <Apparition delai={0.16}>
          <Panneau as="section" className="mt-4 flex flex-wrap items-center gap-6 px-6 py-6">
            <QrCode texte={lien} libelle={`QR code du certificat de ${c.pseudo}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <LibelleSection as="h2">Vérifier ce certificat</LibelleSection>
              <p className="text-sm text-text-2">
                Scanne ce code ou ouvre le lien : la page vient de Najarena, avec sa date d&apos;émission. Une capture
                d&apos;écran peut être retouchée, cette page non.
              </p>
              <code className="text-xs break-all text-muted">{lien}</code>
              <BoutonCopier
                texte={lien}
                libelle="Copier le lien"
                className="inline-flex min-h-11 items-center self-start text-mini font-semibold text-accent uppercase underline underline-offset-3"
              />
            </div>
          </Panneau>
        </Apparition>
      </div>
    </main>
  );
}
