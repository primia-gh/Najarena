import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { lierRiotId, verifierRiotId } from "@/lib/riot-actions";
import { REGIONS, obtenirVersionDDragon, urlIconeProfil } from "@/lib/riot";

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
    <main className="mx-auto max-w-md px-6 py-16">
      <Link
        href="/moi"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-encre">
        Lier mon Riot ID
      </h1>

      {erreur && (
        <p className="mt-6 rounded-[3px] border border-sceau/30 bg-sceau/10 p-3 text-sm text-sceau">
          {erreur}
        </p>
      )}

      {compte?.verifie_le ? (
        <div className="mt-6 rounded-[3px] border border-atteste/30 bg-atteste/10 p-4">
          <p className="font-mono text-sm text-atteste">
            Vérifié : {compte.riot_game_name}#{compte.riot_tag_line} · {compte.region}
          </p>
        </div>
      ) : compte?.defi_icone_id != null ? (
        <EtapeVerification puuid={compte.puuid} defiIconeId={compte.defi_icone_id} />
      ) : (
        <EtapeSaisie />
      )}
    </main>
  );
}

function EtapeSaisie() {
  return (
    <>
      <p className="mt-2 text-sm text-ardoise">
        Entre ton Riot ID exactement comme il apparaît dans le client League
        of Legends.
      </p>
      <form action={lierRiotId} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Riot ID
          </span>
          <input
            name="riot_id"
            type="text"
            required
            placeholder="Pseudo#TAG"
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Région
          </span>
          <select
            name="region"
            required
            defaultValue=""
            className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre"
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

        <button
          type="submit"
          className="mt-2 rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
        >
          Continuer
        </button>
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
      <p className="text-sm text-ardoise">
        Pour prouver que ce compte t&apos;appartient, change ton icône de
        profil en jeu pour celle-ci, sauvegarde, puis reviens ici.
      </p>

      <Image
        src={urlIcone}
        alt={`Icône de profil numéro ${defiIconeId}`}
        width={96}
        height={96}
        className="mt-4 rounded-[3px] border border-trait"
        unoptimized
      />

      <form action={verifierRiotId} className="mt-6">
        <input type="hidden" name="puuid" value={puuid} />
        <button
          type="submit"
          className="rounded-[3px] bg-sceau px-4 py-2 text-sm font-semibold text-papier transition hover:brightness-110"
        >
          J&apos;ai changé mon icône, vérifier
        </button>
      </form>
    </div>
  );
}
