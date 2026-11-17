import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { destinationInterne } from "@/lib/redirection";
import { createClient } from "@/lib/supabase/server";
import {
  definirComptePrincipal,
  delierCompteRiot,
  delierCompteSecondaire,
  lierRiotId,
  verifierRiotId,
} from "@/lib/riot-actions";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import { REGIONS, obtenirVersionDDragon, urlIconeProfil } from "@/lib/riot";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import { BadgeVerifie } from "@/components/design/Badges";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import ReperesVisee from "@/components/design/ReperesVisee";

export const metadata: Metadata = {
  title: "Lier mon Riot ID — Najarena",
  robots: { index: false, follow: false },
};

interface LierRiotPageProps {
  searchParams: Promise<{ erreur?: string; message?: string; suite?: string }>;
}

export default async function LierRiotPage({ searchParams }: LierRiotPageProps) {
  const { erreur, message, suite: suiteDemandee } = await searchParams;
  // Page où revenir une fois le compte vérifié (lien de défi d'un ami, audit N18).
  const suite = suiteDemandee ? destinationInterne(suiteDemandee, "") || null : null;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: comptes } = await supabase
    .from("game_accounts")
    .select("puuid, riot_game_name, riot_tag_line, region, verifie_le, defi_icone_id, est_principal")
    .eq("profile_id", userData.user.id)
    .eq("game_id", 1);
  const compte = (comptes ?? []).find((c) => c.est_principal) ?? null;
  // Comptes secondaires déclarés (audit N15).
  const secondaires = (comptes ?? []).filter((c) => !c.est_principal);

  // Où en est le joueur (revue visuelle du 09/10/2026) : 1 saisir son Riot
  // ID, 2 changer son icône de profil, 3 vérifié. Mêmes états qu'avant,
  // lus dans game_accounts ; seul l'affichage change.
  const etape = compte?.verifie_le ? 3 : compte?.defi_icone_id != null ? 2 : 1;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-xl">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Mon compte
          </Link>
          <LibelleSection className="mt-6">Compte Riot</LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase">Lier mon Riot ID</h1>
          <p className="mt-4 text-text-2">
            Cette vérification prouve que le compte t&apos;appartient — elle sert de base à ton CV e-sport vérifié.
          </p>
          <ol className="mt-8 grid grid-cols-3 gap-3" aria-label="Étapes de la vérification">
            {["Riot ID", "Icône de profil", "Vérifié"].map((libelle, i) => {
              const n = i + 1;
              const fait = n < etape || etape === 3;
              const enCours = n === etape && etape !== 3;
              return (
                <li
                  key={libelle}
                  aria-current={enCours ? "step" : undefined}
                  className={`flex flex-col gap-2 border-t-2 pt-3 ${fait ? "border-text-2" : enCours ? "border-accent" : "border-line-strong"}`}
                >
                  <span
                    className={`inline-flex items-start gap-1.5 font-texte text-mini font-semibold uppercase ${
                      fait ? "text-text-2" : enCours ? "text-text" : "text-faint"
                    }`}
                  >
                    {fait ? (
                      <Icone nom="coche" taille={13} epaisseur={2.5} className="mt-px shrink-0" />
                    ) : (
                      <span className="tabular-nums">{String(n).padStart(2, "0")}</span>
                    )}
                    {libelle}
                  </span>
                </li>
              );
            })}
          </ol>
        </Apparition>

        {(erreur || message) && (
          <div className="flex flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        <Apparition delai={0.06}>
          {compte?.verifie_le ? (
            <Panneau className="flex flex-col gap-4 p-6">
              <BadgeVerifie>Compte vérifié</BadgeVerifie>
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-titre text-3xl leading-none font-black">
                  {compte.riot_game_name}
                  <span className="text-muted">#{compte.riot_tag_line}</span>
                </span>
                <span className="text-sm text-muted">{compte.region} · compte principal</span>
              </p>
              {suite && (
                <BoutonLien href={suite} className="self-start">
                  Continuer
                </BoutonLien>
              )}
            </Panneau>
          ) : compte?.defi_icone_id != null ? (
            <EtapeVerification puuid={compte.puuid} defiIconeId={compte.defi_icone_id} />
          ) : (
            <EtapeSaisie suite={suite} />
          )}
        </Apparition>

        {compte?.verifie_le && (
          <Apparition delai={0.08}>
            <section className="flex flex-col gap-4" aria-labelledby="titre-secondaires">
              <LibelleSection as="h2" id="titre-secondaires" className="border-b border-line-strong pb-4">
                Comptes secondaires déclarés
              </LibelleSection>
              <p className="text-sm text-text-2">
                Tu joues aussi sur d&apos;autres comptes ? Déclare-les : une fois vérifiés, ils s&apos;affichent sur ton CV,
                en transparence. Seul ton compte principal t&apos;inscrit aux tournois et sert à lire tes résultats.
              </p>
              {secondaires.length > 0 && (
                <ul className="flex flex-col">
                  {secondaires.map((s) => (
                    <li key={s.puuid} className="flex flex-col gap-2 border-b border-line py-4 last:border-b-0">
                      <p className="flex flex-wrap items-center justify-between gap-3">
                        <span className="font-semibold tabular-nums">
                          {s.riot_game_name}
                          <span className="text-muted">#{s.riot_tag_line}</span>
                          <span className="ml-2 text-sm font-normal text-muted">{s.region}</span>
                        </span>
                        {s.verifie_le ? (
                          <BadgeVerifie />
                        ) : (
                          <span className="font-texte text-mini font-semibold text-text-2 uppercase">À vérifier</span>
                        )}
                      </p>
                      {!s.verifie_le && s.defi_icone_id != null && (
                        <EtapeVerification puuid={s.puuid} defiIconeId={s.defi_icone_id} />
                      )}
                      <div className="flex flex-wrap gap-x-5">
                        {s.verifie_le && (
                          <form action={definirComptePrincipal}>
                            <input type="hidden" name="puuid" value={s.puuid} />
                            <BoutonConfirmation
                              type="submit"
                              confirmation={`Faire de ${s.riot_game_name}#${s.riot_tag_line} ton compte principal ? Il t'inscrira aux tournois et servira à lire tes résultats.`}
                              className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-text underline underline-offset-3 hover:text-accent"
                            >
                              Définir comme principal
                            </BoutonConfirmation>
                          </form>
                        )}
                        <form action={delierCompteSecondaire}>
                          <input type="hidden" name="puuid" value={s.puuid} />
                          <BoutonConfirmation
                            type="submit"
                            confirmation={`Retirer ${s.riot_game_name}#${s.riot_tag_line} de tes comptes déclarés ?`}
                            className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-text"
                          >
                            Retirer
                          </BoutonConfirmation>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {(comptes ?? []).length < 3 && (
                <details className="group panneau p-5">
                  <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-text [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="transition-transform duration-200 group-open:rotate-90">
                      ›
                    </span>
                    Déclarer un compte secondaire
                  </summary>
                  <div className="mt-2">
                    <EtapeSaisie suite={null} secondaire />
                  </div>
                </details>
              )}
            </section>
          </Apparition>
        )}

        {compte && (
          <form action={delierCompteRiot} className="border-t border-line pt-6">
            <BoutonConfirmation
              type="submit"
              confirmation={`Délier ${compte.riot_game_name}#${compte.riot_tag_line}${secondaires.length > 0 ? " et tes comptes secondaires" : ""} ? Il faudra refaire la vérification pour lier un compte.`}
              className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
            >
              {compte.verifie_le ? "Délier ce compte" : "Changer de Riot ID"}
            </BoutonConfirmation>
          </form>
        )}
      </div>
    </main>
  );
}

function EtapeSaisie({ suite, secondaire = false }: { suite: string | null; secondaire?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-2">Entre ton Riot ID exactement comme il apparaît dans le client League of Legends.</p>
      <form action={lierRiotId} className="flex flex-col gap-4">
        {suite && <input type="hidden" name="suite" value={suite} />}
        {secondaire && <input type="hidden" name="principal" value="non" />}
        <label className="flex flex-col gap-1.5">
          <span className="font-texte text-mini font-medium text-muted uppercase">Riot ID</span>
          <input name="riot_id" type="text" required placeholder="Pseudo#TAG" className={classeChamp()} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-texte text-mini font-medium text-muted uppercase">Région</span>
          <select name="region" required defaultValue="" className={classeChamp()}>
            <option value="" disabled>
              Choisis ta région
            </option>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.nom}
              </option>
            ))}
          </select>
        </label>
        <BoutonEnvoi libelleEnCours="Envoi…" className="mt-2 self-start">
          Continuer
        </BoutonEnvoi>
      </form>
    </div>
  );
}

async function EtapeVerification({
  puuid,
  defiIconeId,
}: {
  puuid: string;
  defiIconeId: number;
}) {
  const version = await obtenirVersionDDragon();
  const urlIcone = urlIconeProfil(version, defiIconeId);

  return (
    <Panneau className="flex flex-col gap-5 p-6">
      <p className="text-text-2">
        Pour prouver que ce compte t&apos;appartient, change ton icône de profil en jeu pour celle-ci, sauvegarde, puis
        reviens ici.
      </p>
      <div className="relative self-start p-8">
        <ReperesVisee />
        <Image
          src={urlIcone}
          alt={`Icône de profil numéro ${defiIconeId}`}
          width={96}
          height={96}
          className="rounded-avatar border border-line"
          unoptimized
        />
      </div>
      <form action={verifierRiotId}>
        <input type="hidden" name="puuid" value={puuid} />
        <BoutonEnvoi libelleEnCours="Vérification…">J&apos;ai changé mon icône, vérifier</BoutonEnvoi>
      </form>
    </Panneau>
  );
}
