import Link from "next/link";
import BracketBackground from "@/components/BracketBackground";
import { createClient } from "@/lib/supabase/server";

async function chargerPreuveSociale() {
  const supabase = await createClient();

  const [{ count: tournois }, { count: matchs }, { count: joueurs }] = await Promise.all([
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("statut", "termine"),
    supabase
      .from("match_verdicts")
      .select("*", { count: "exact", head: true })
      .eq("est_definitif", true),
    supabase.from("ratings").select("*", { count: "exact", head: true }).eq("est_classe", true),
  ]);

  return {
    tournois: tournois ?? 0,
    matchs: matchs ?? 0,
    joueurs: joueurs ?? 0,
  };
}

export default async function Home() {
  const preuve = await chargerPreuveSociale();
  // Jamais de chiffre inventé : chaque statistique vient d'un vrai compte en
  // base, et une statistique à zéro ne s'affiche pas plutôt que d'afficher
  // "0" (qui découragerait sans rien prouver).
  const stats = [
    { valeur: preuve.joueurs, libelle: "joueurs classés" },
    { valeur: preuve.tournois, libelle: "tournois joués" },
    { valeur: preuve.matchs, libelle: "matchs enregistrés" },
  ].filter((s) => s.valeur > 0);

  return (
    <section className="accueil relative isolate flex min-h-screen flex-col justify-center overflow-hidden bg-[var(--nuit-encre)] px-6 py-24">
      <BracketBackground />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, rgba(11,14,20,.15) 0%, rgba(11,14,20,.82) 72%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-2xl">
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.24em] text-[var(--nuit-ardoise)]">
          League of Legends · 1v1 quotidien
        </span>

        <h1 className="mt-3 font-display text-5xl leading-[0.98] font-extrabold tracking-tight text-[var(--nuit-papier)] sm:text-7xl">
          Ton niveau,
          <br />
          <span className="text-[var(--nuit-sceau)]">vérifié.</span>
        </h1>

        <p className="mt-4 max-w-md text-[1.02rem] text-[#B9BFC7]">
          Des tournois quotidiens en 1v1. Les résultats sont lus dans la partie
          officielle — aucune capture d&apos;écran, aucun litige. Ton
          classement devient une preuve.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/lol/tournois"
            className="rounded-[3px] bg-[var(--nuit-sceau)] px-5 py-3 text-sm font-semibold text-[#14090C] transition hover:brightness-110"
          >
            Voir les tournois
          </Link>
          <Link
            href="/lol/classement"
            className="rounded-[3px] border border-white/20 bg-white/6 px-5 py-3 text-sm font-semibold text-[var(--nuit-papier)] transition hover:border-white/40"
          >
            Voir le classement
          </Link>
        </div>

        {stats.length > 0 && (
          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6">
            {stats.map((s) => (
              <div key={s.libelle}>
                <dd className="font-mono text-2xl font-bold tracking-tight text-[var(--nuit-papier)]">
                  {s.valeur}
                </dd>
                <dt className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--nuit-ardoise)] uppercase">
                  {s.libelle}
                </dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
