import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { retirerDeLaWatchlist } from "@/lib/watchlist-actions";
import { progressionPalier, type Palier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { classeCarte } from "@/lib/ui";
import CrestPalier from "@/components/ui/CrestPalier";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Ma watchlist — Najarena",
  robots: { index: false, follow: false },
};

interface WatchlistPageProps {
  searchParams: Promise<{ message?: string; erreur?: string }>;
}

export default async function WatchlistPage({ searchParams }: WatchlistPageProps) {
  const { message, erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { offre } = await chargerOffre(supabase, userData.user.id);
  if (offre !== "organisateur") {
    redirect(`/tarifs?erreur=${encodeURIComponent("La watchlist demande l'offre Organisateur.")}`);
  }

  const [{ data: watchlistData }, { data: saison }, { data: paliersData }] = await Promise.all([
    supabase
      .from("watchlist")
      .select("joueur_suivi_id, cree_le, joueur:profiles!watchlist_joueur_suivi_id_fkey(pseudo, slug)")
      .eq("recruteur_id", userData.user.id)
      .order("cree_le", { ascending: false }),
    supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);

  const suivis = (watchlistData ?? []).filter((w) => w.joueur);
  const paliers: Palier[] = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  let ratingsParJoueur = new Map<string, number>();
  if (saison && suivis.length > 0) {
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select("profile_id, rating")
      .eq("game_id", 1)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .in("profile_id", suivis.map((s) => s.joueur_suivi_id));

    ratingsParJoueur = new Map((ratingsData ?? []).map((r) => [r.profile_id, r.rating]));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-5xl px-gouttiere">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← Mon compte
          </Link>
          <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Ma watchlist
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Les joueurs que tu suis, avec leur palier actuel.{" "}
            <Link href="/lol/recherche" className="text-text underline underline-offset-3">
              Rechercher des joueurs
            </Link>
            .
          </p>
        </Apparition>

        {erreur && (
          <p className={"mt-4 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
        )}
        {message && (
          <p className={"mt-4 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
        )}

        <Apparition delai={0.1}>
          <section className="mt-8">
            {suivis.length === 0 ? (
              <div className="mt-3">
                <EtatVide illustration={<IllustrationEffectifVide />}>
                  Aucun joueur suivi pour l&apos;instant.
                </EtatVide>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {suivis.map((s) => {
                  const rating = ratingsParJoueur.get(s.joueur_suivi_id);
                  const { palier, progression } =
                    rating !== undefined ? progressionPalier(rating, paliers) : { palier: null, progression: 0 };
                  return (
                    <li key={s.joueur_suivi_id} className={"flex items-center justify-between gap-3 " + classeCarte("none")}>
                      <Link href={`/joueur/${s.joueur!.slug}`} className="text-sm font-semibold text-text hover:underline">
                        {s.joueur!.pseudo}
                      </Link>
                      <div className="flex shrink-0 items-center gap-3">
                        {palier ? (
                          <CrestPalier
                            nom={palier.nom}
                            couleur={COULEUR_PALIER[palier.nom.toLowerCase()] ?? "var(--color-muted)"}
                            progression={progression}
                          />
                        ) : (
                          <span className="font-texte tabular-nums text-mini text-muted">Non classé</span>
                        )}
                        <form action={retirerDeLaWatchlist}>
                          <input type="hidden" name="joueur_suivi_id" value={s.joueur_suivi_id} />
                          <input type="hidden" name="retour" value="/moi/watchlist" />
                          <button
                            type="submit"
                            aria-label={`Retirer ${s.joueur!.pseudo} de la watchlist`}
                            className="inline-flex min-h-11 items-center font-texte tabular-nums text-mini text-danger underline underline-offset-3"
                          >
                            Retirer
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Apparition>
      </div>
    </main>
  );
}
