import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { progressionPalier, arrondir } from "@/lib/classement";
import { classeCarte } from "@/lib/ui";
import { COULEUR_PALIER } from "@/lib/paliers";
import CrestPalier from "@/components/ui/CrestPalier";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationSceauVide from "@/components/ui/IllustrationSceauVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Classement LoL — Najarena",
  description:
    "Classement League of Legends Najarena, calculé en Glicko-2 à partir de résultats vérifiés dans la donnée officielle Riot.",
};

export default async function ClassementPage() {
  const supabase = await createClient();

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug. `saison` et `paliers` sont indépendants l'un de
  // l'autre, lancés en parallèle plutôt qu'en série.
  const [{ data: saison }, { data: paliersData }] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, nom, numero")
      .eq("game_id", 1)
      .eq("est_courante", true)
      .maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);

  let classement: Array<{
    rating: number;
    rd: number;
    matchs_joues: number;
    profile: { pseudo: string; slug: string } | null;
  }> = [];
  let erreurClassement = false;

  if (saison) {
    const { data, error } = await supabase
      .from("ratings")
      .select("rating, rd, matchs_joues, profile:profiles(pseudo, slug)")
      .eq("game_id", 1)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .order("rating", { ascending: false })
      .limit(100);

    classement = data ?? [];
    if (error) erreurClassement = true;
  }

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const paliersTries = [...paliers].sort((a, b) => a.ratingMin - b.ratingMin);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
      <Apparition>
        <span className="block font-texte text-libelle font-medium text-muted uppercase">
          League of Legends
        </span>
        <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
          Classement
        </h1>
        {saison?.nom && (
          <p className="mt-1 font-texte tabular-nums text-[0.72rem] text-muted">{saison.nom}</p>
        )}
        <p className="mt-3 max-w-lg text-sm text-muted">
          Calculé en Glicko-2, recalculé à la clôture de chaque tournoi. Un joueur entre au
          classement une fois son incertitude (RD) descendue sous 150 — une dizaine de matchs ; en
          dessous, il reste visible mais non classé.
        </p>
        {paliersTries.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {paliersTries.map((p, i) => {
              const suivant = paliersTries[i + 1]?.ratingMin;
              const seuil = i === 0 && suivant !== undefined ? `< ${suivant}` : String(p.ratingMin);
              const couleur = COULEUR_PALIER[p.nom.toLowerCase()] ?? "var(--color-muted)";
              return (
                <span
                  key={p.nom}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-texte tabular-nums text-mini tracking-[0.06em] uppercase"
                  style={{ color: couleur }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: couleur }} />
                  {p.nom} · {seuil}
                </span>
              );
            })}
          </div>
        )}
      </Apparition>

      <Apparition delai={0.1}>
      <div className="mt-8">
        {!saison ? (
          <EtatVide illustration={<IllustrationSceauVide />}>
            Le classement n&apos;est pas encore ouvert — aucune saison n&apos;est
            en cours pour l&apos;instant.
          </EtatVide>
        ) : erreurClassement ? (
          <p className={classeCarte("sceau") + " text-sm text-danger"}>
            Impossible de charger le classement pour l&apos;instant. Réessaie
            dans un instant.
          </p>
        ) : classement.length === 0 ? (
          <EtatVide illustration={<IllustrationSceauVide />}>
            Aucun joueur classé pour l&apos;instant. L&apos;entrée au
            classement demande une dizaine de matchs joués.
          </EtatVide>
        ) : (
          <ol className="overflow-hidden rounded-[3px] border border-line bg-surface shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
            {classement.map((r, i) => {
              const { palier, progression } = progressionPalier(r.rating, paliers);
              const podium = i < 3;
              return (
                <li
                  key={r.profile?.slug ?? i}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 border-b border-line px-4 py-3 text-sm last:border-b-0 ${
                    podium ? "bg-accent/8" : ""
                  }`}
                >
                  <span className={`font-texte tabular-nums text-[0.8rem] ${podium ? "font-bold text-accent" : "text-muted"}`}>
                    #{i + 1}
                  </span>
                  <span className="font-medium text-text">
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
                      couleur={COULEUR_PALIER[palier.nom.toLowerCase()] ?? "var(--color-muted)"}
                      progression={progression}
                    />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  <span className="font-texte tabular-nums text-base font-bold text-text">{arrondir(r.rating)}</span>
                  <span className="font-texte tabular-nums text-[0.72rem] text-muted">
                    {r.matchs_joues} matchs
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      </Apparition>
      </div>
    </main>
  );
}
