import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { lierRiotId, verifierRiotId } from "@/lib/riot-actions";
import { REGIONS, obtenirVersionDDragon, urlIconeProfil } from "@/lib/riot";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Lier mon Riot ID — Najarena",
  robots: { index: false, follow: false },
};

interface LierRiotPageProps {
  searchParams: Promise<{ erreur?: string }>;
}

export default async function LierRiotPage({ searchParams }: LierRiotPageProps) {
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: compte } = await supabase
    .from("game_accounts")
    .select("puuid, riot_game_name, riot_tag_line, region, verifie_le, defi_icone_id")
    .eq("profile_id", userData.user.id)
    .eq("est_principal", true)
    .maybeSingle();

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-md px-gouttiere">
      <Apparition>
      <Link
        href="/moi"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Lier mon Riot ID
      </h1>
      <p className="mt-1 text-sm text-muted">
        Cette vérification prouve que le compte t&apos;appartient — elle sert de base à ton CV
        e-sport vérifié.
      </p>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}

      {compte?.verifie_le ? (
        <div className={"mt-6 " + classeCarte("atteste")}>
          <p className="font-texte tabular-nums text-sm text-accent">
            Vérifié : {compte.riot_game_name}#{compte.riot_tag_line} · {compte.region}
          </p>
        </div>
      ) : compte?.defi_icone_id != null ? (
        <EtapeVerification puuid={compte.puuid} defiIconeId={compte.defi_icone_id} />
      ) : (
        <EtapeSaisie />
      )}
      </Apparition>
      </div>
    </main>
  );
}

function EtapeSaisie() {
  return (
    <>
      <p className="mt-2 text-sm text-muted">
        Entre ton Riot ID exactement comme il apparaît dans le client League
        of Legends.
      </p>
      <form action={lierRiotId} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Riot ID
          </span>
          <input
            name="riot_id"
            type="text"
            required
            placeholder="Pseudo#TAG"
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Région
          </span>
          <select
            name="region"
            required
            defaultValue=""
            className="rounded-[3px] border border-line bg-bg px-3 py-2 text-sm text-text"
          >
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

        <Bouton libelleEnCours="Envoi…" className="mt-2">
          Continuer
        </Bouton>
      </form>
    </>
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
    <div className="mt-6">
      <p className="text-sm text-muted">
        Pour prouver que ce compte t&apos;appartient, change ton icône de
        profil en jeu pour celle-ci, sauvegarde, puis reviens ici.
      </p>

      <Image
        src={urlIcone}
        alt={`Icône de profil numéro ${defiIconeId}`}
        width={96}
        height={96}
        className="mt-4 rounded-[3px] border border-line"
        unoptimized
      />

      <form action={verifierRiotId} className="mt-6">
        <input type="hidden" name="puuid" value={puuid} />
        <Bouton libelleEnCours="Vérification…">J&apos;ai changé mon icône, vérifier</Bouton>
      </form>
    </div>
  );
}
