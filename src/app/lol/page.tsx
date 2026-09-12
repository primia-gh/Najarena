import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LABEL_STATUT, formaterDate, type StatutPublic } from "@/lib/tournois";
import NavbarArene from "@/components/accueil/NavbarArene";
import FondArene from "@/components/accueil/FondArene";
import Reveal from "@/components/accueil/Reveal";

export const metadata: Metadata = {
  title: "League of Legends — Najarena",
  description:
    "Tournois League of Legends en 1v1, quotidiens, sur Najarena. Résultats lus dans la donnée officielle Riot, classement Glicko-2 vérifié.",
};

const COULEUR_STATUT_NUIT: Record<StatutPublic, string> = {
  ouvert: "text-[var(--nuit-atteste)]",
  checkin: "text-[var(--nuit-laiton)]",
  en_cours: "text-[var(--nuit-sceau)]",
  termine: "text-[var(--nuit-ardoise)]",
  annule: "text-[var(--nuit-ardoise)]",
};

export default async function LolHubPage() {
  const supabase = await createClient();

  const { data: jeu } = await supabase.from("games").select("id").eq("slug", "lol").maybeSingle();

  let prochainsTournois: Array<{
    slug: string;
    nom: string;
    format: string;
    capacite: number;
    region: string;
    statut: StatutPublic;
    debute_le: string;
  }> = [];

  if (jeu) {
    const { data } = await supabase
      .from("tournaments")
      .select("slug, nom, format, capacite, region, statut, debute_le")
      .eq("game_id", jeu.id)
      .in("statut", ["ouvert", "checkin"])
      .order("debute_le", { ascending: true })
      .limit(6);
    prochainsTournois = (data ?? []) as typeof prochainsTournois;
  }

  return (
    <div className="accueil min-h-screen bg-[var(--nuit-encre)]">
      <NavbarArene />

      <section className="relative overflow-hidden px-6 pt-40 pb-16">
        <FondArene />
        <div className="relative mx-auto max-w-3xl">
          <Reveal>
            <span className="font-mono text-[0.66rem] tracking-[0.22em] text-[var(--nuit-ardoise)] uppercase">
              League of Legends
            </span>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-[var(--nuit-papier)] sm:text-5xl">
              Ton niveau, vérifié.
            </h1>
            <p className="mt-3 max-w-md text-[var(--nuit-ardoise)]">
              Des tournois 1v1 et 5v5 quotidiens. Les résultats sont lus dans
              la donnée officielle Riot — ton classement devient une preuve,
              pas une déclaration.
            </p>
          </Reveal>

          <Reveal delai={0.1}>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/lol/tournois"
                className="rounded-[2px] bg-[var(--nuit-sceau)] px-4 py-2 text-sm font-semibold text-[#14090C] shadow-[0_8px_24px_-6px_var(--nuit-sceau-lueur)] transition hover:-translate-y-0.5 hover:brightness-110"
                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
              >
                Voir les tournois
              </Link>
              <Link
                href="/lol/classement"
                className="rounded-[2px] border border-white/20 bg-white/6 px-4 py-2 text-sm font-semibold text-[var(--nuit-papier)] transition hover:border-white/40"
                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
              >
                Voir le classement
              </Link>
              <Link
                href="/lol/coequipiers"
                className="rounded-[2px] border border-white/20 bg-white/6 px-4 py-2 text-sm font-semibold text-[var(--nuit-papier)] transition hover:border-white/40"
                style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
              >
                Trouver un coéquipier
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative bg-gradient-to-b from-[var(--nuit-encre)] to-[var(--nuit-fond-1)] px-6 pt-8 pb-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--nuit-papier)]">
                Prochains tournois
              </h2>
              <Link
                href="/lol/tournois"
                className="font-mono text-[0.7rem] text-[var(--nuit-ardoise)] underline underline-offset-3 hover:text-[var(--nuit-papier)]"
              >
                Tout voir
              </Link>
            </div>
          </Reveal>

          {prochainsTournois.length === 0 ? (
            <Reveal delai={0.1}>
              <p className="mt-4 border border-[var(--nuit-trait)] bg-[var(--nuit-fond-2)] p-4 text-sm text-[var(--nuit-ardoise)]">
                Aucun tournoi ouvert pour l&apos;instant.{" "}
                <Link href="/organiser/nouveau" className="text-[var(--nuit-papier)] underline underline-offset-3">
                  Organiser le premier
                </Link>
                .
              </p>
            </Reveal>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {prochainsTournois.map((t, i) => (
                <Reveal key={t.slug} delai={Math.min(i * 0.06, 0.3)}>
                  <Link
                    href={`/lol/tournois/${t.slug}`}
                    className="group block border border-[var(--nuit-trait)] bg-[var(--nuit-fond-2)] p-4 transition-[border-color,box-shadow] duration-300 hover:border-[var(--nuit-sceau)]/40 hover:shadow-[0_0_0_1px_rgba(196,72,92,0.3),0_20px_44px_-16px_var(--nuit-sceau-lueur)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-lg font-extrabold tracking-tight text-[var(--nuit-papier)]">
                        {t.nom}
                      </span>
                      <span className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase ${COULEUR_STATUT_NUIT[t.statut]}`}>
                        {LABEL_STATUT[t.statut]}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[0.72rem] text-[var(--nuit-ardoise)]">
                      {t.format} · {t.capacite} joueurs · {t.region} · {formaterDate(t.debute_le)}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
