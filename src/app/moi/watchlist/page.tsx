import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { retirerDeLaWatchlist } from "@/lib/watchlist-actions";
import { arrondir, trouverPalier, type Palier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { formaterDate } from "@/lib/tournois";
import Alerte from "@/components/design/Alerte";
import EtatVide from "@/components/design/EtatVide";
import EnTetePage from "@/components/design/EnTetePage";
import Apparition from "@/components/design/Apparition";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import Tableau from "@/components/design/Tableau";

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
      .select("joueur_suivi_id, cree_le, joueur:profiles!watchlist_joueur_suivi_id_fkey(pseudo, slug, avatar_url)")
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
      <div className="relative flex flex-col gap-10 px-grille">
        <EnTetePage
          retour={{ href: "/moi", libelle: "Mon compte" }}
          surtitre={`Offre Organisateur · ${suivis.length} suivi${suivis.length > 1 ? "s" : ""}`}
          titre="Ma watchlist"
          intro="Les joueurs que tu suis, avec leur palier et leur rating actuels."
          aside={
            <BoutonLien href="/lol/recherche" variante="contour">
              Rechercher des joueurs
            </BoutonLien>
          }
        />

        {(erreur || message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        <Apparition delai={0.08}>
          {suivis.length === 0 ? (
            <EtatVide titre="Aucun joueur suivi.">
              Suis un joueur depuis la recherche ou depuis son CV (bouton « Suivre »).
            </EtatVide>
          ) : (
            <Tableau legende="Joueurs suivis">
              <thead>
                <tr>
                  <th scope="col">Joueur</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Palier
                  </th>
                  <th scope="col" className="text-right!">
                    Rating
                  </th>
                  <th scope="col" className="hidden text-right! md:table-cell">
                    Suivi depuis
                  </th>
                  <th scope="col" className="text-right!">
                    <span className="sr-only">Retirer</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {suivis.map((s) => {
                  const rating = ratingsParJoueur.get(s.joueur_suivi_id);
                  const palier = rating !== undefined ? (trouverPalier(rating, paliers)?.nom ?? null) : null;
                  return (
                    <tr key={s.joueur_suivi_id}>
                      <td className="py-3!">
                        <Link
                          href={`/joueur/${s.joueur!.slug}`}
                          className="inline-flex min-h-11 items-center gap-3 font-semibold hover:text-accent"
                        >
                          <AvatarJoueur pseudo={s.joueur!.pseudo} src={s.joueur!.avatar_url} />
                          {s.joueur!.pseudo}
                        </Link>
                      </td>
                      <td className="hidden py-3! text-sm text-text-2 sm:table-cell">
                        {palier ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 rounded-full"
                              style={{ background: COULEUR_PALIER[palier.toLowerCase()] ?? "var(--color-muted)" }}
                            />
                            {palier}
                          </span>
                        ) : (
                          <span className="text-faint">Non classé</span>
                        )}
                      </td>
                      <td className="py-3! text-right font-titre text-2xl font-extrabold tabular-nums">
                        {rating !== undefined ? arrondir(rating) : <span className="font-texte text-sm font-normal text-faint">—</span>}
                      </td>
                      <td className="hidden py-3! text-right text-sm text-muted tabular-nums md:table-cell">
                        {formaterDate(s.cree_le).split(" ")[0]}
                      </td>
                      <td className="py-3! text-right">
                        <form action={retirerDeLaWatchlist}>
                          <input type="hidden" name="joueur_suivi_id" value={s.joueur_suivi_id} />
                          <input type="hidden" name="retour" value="/moi/watchlist" />
                          <button
                            type="submit"
                            aria-label={`Retirer ${s.joueur!.pseudo} de la watchlist`}
                            className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
                          >
                            Retirer
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tableau>
          )}
        </Apparition>
      </div>
    </main>
  );
}
