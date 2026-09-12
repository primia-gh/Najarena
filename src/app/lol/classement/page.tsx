import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { progressionPalier, arrondir } from "@/lib/classement";
import { classeCarte } from "@/lib/ui";
import { COULEUR_PALIER } from "@/lib/paliers";
import CrestPalier from "@/components/ui/CrestPalier";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

export const metadata: Metadata = {
  title: "Classement LoL — Najarena",
  description:
    "Classement League of Legends Najarena, calculé en Glicko-2 à partir de résultats vérifiés dans la donnée officielle Riot.",
};

export default async function ClassementPage() {
  const supabase = await createClient();

  const { data: jeu } = await supabase.from("games").select("id").eq("slug", "lol").maybeSingle();

  const { data: saison } = jeu
    ? await supabase
        .from("seasons")
        .select("id, nom, numero")
        .eq("game_id", jeu.id)
        .eq("est_courante", true)
        .maybeSingle()
    : { data: null };

  let classement: Array<{
    rating: number;
    rd: number;
    matchs_joues: number;
    profile: { pseudo: string; slug: string } | null;
  }> = [];
  let erreurClassement = false;

  if (jeu && saison) {
    const { data, error } = await supabase
      .from("ratings")
      .select("rating, rd, matchs_joues, profile:profiles(pseudo, slug)")
      .eq("game_id", jeu.id)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .order("rating", { ascending: false })
      .limit(100);

    classement = data ?? [];
    if (error) erreurClassement = true;
  }

  const { data: paliersData } = await supabase
    .from("tiers")
    .select("nom, rating_min")
    .eq("game_id", 1);

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const paliersTries = [...paliers].sort((a, b) => a.ratingMin - b.ratingMin);

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
      <Reveal>
        <span className="block font-mono text-[0.66rem] tracking-[0.22em] text-ardoise uppercase">
          League of Legends
        </span>
        <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-encre">
          Classement
        </h1>
        {saison?.nom && (
          <p className="mt-1 font-mono text-[0.72rem] text-ardoise">{saison.nom}</p>
        )}
        <p className="mt-3 max-w-lg text-sm text-ardoise">
          Calculé en Glicko-2, recalculé à la clôture de chaque tournoi. Un joueur entre au
          classement une fois son incertitude (RD) descendue sous 150 — une dizaine de matchs ; en
          dessous, il reste visible mais non classé.
        </p>
        {paliersTries.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {paliersTries.map((p, i) => {
              const suivant = paliersTries[i + 1]?.ratingMin;
              const seuil = i === 0 && suivant !== undefined ? `< ${suivant}` : String(p.ratingMin);
              const couleur = COULEUR_PALIER[p.nom.toLowerCase()] ?? "var(--color-ardoise)";
              return (
                <span
                  key={p.nom}
                  className="inline-flex items-center gap-1.5 rounded-full border border-trait bg-carte px-2.5 py-1 font-mono text-[0.64rem] tracking-[0.06em] uppercase"
                  style={{ color: couleur }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: couleur }} />
                  {p.nom} · {seuil}
                </span>
              );
            })}
          </div>
        )}
      </Reveal>

      <Reveal delai={0.1}>
      <div className="mt-8">
        {!saison ? (
          <p className={classeCarte("none") + " text-sm text-ardoise"}>
            Le classement n&apos;est pas encore ouvert — aucune saison n&apos;est
            en cours pour l&apos;instant.
          </p>
        ) : erreurClassement ? (
          <p className={classeCarte("sceau") + " text-sm text-sceau"}>
            Impossible de charger le classement pour l&apos;instant. Réessaie
            dans un instant.
          </p>
        ) : classement.length === 0 ? (
          <p className={classeCarte("none") + " text-sm text-ardoise"}>
            Aucun joueur classé pour l&apos;instant. L&apos;entrée au
            classement demande une dizaine de matchs joués.
          </p>
        ) : (
          <ol className="overflow-hidden rounded-[3px] border border-trait bg-carte shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
            {classement.map((r, i) => {
              const { palier, progression } = progressionPalier(r.rating, paliers);
              const podium = i < 3;
              return (
                <li
                  key={r.profile?.slug ?? i}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 border-b border-trait px-4 py-3 text-sm last:border-b-0 ${
                    podium ? "bg-laiton/8" : ""
                  }`}
                >
                  <span className={`font-mono text-[0.8rem] ${podium ? "font-bold text-laiton-texte" : "text-ardoise"}`}>
                    #{i + 1}
                  </span>
                  <span className="font-medium text-encre">
                    {r.profile ? (
                      <Link href={`/joueur/${r.profile.slug}`} className="hover:underline">
                        {r.profile.pseudo}
                      </Link>
                    ) : (
                      "Joueur inconnu"
                    )}
                  </span>
                  {palier ? (
                    <CrestPalier
                      nom={palier.nom}
                      couleur={COULEUR_PALIER[palier.nom.toLowerCase()] ?? "var(--color-ardoise)"}
                      progression={progression}
                    />
                  ) : (
                    <span className="text-ardoise">—</span>
                  )}
                  <span className="font-mono text-base font-bold text-encre">{arrondir(r.rating)}</span>
                  <span className="font-mono text-[0.72rem] text-ardoise">
                    {r.matchs_joues} matchs
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      </Reveal>
      </div>
    </main>
  );
}
