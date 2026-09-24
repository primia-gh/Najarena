import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { progressionPalier, type Palier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { REGIONS } from "@/lib/regions";
import { ROLES, LABEL_ROLE, type Role } from "@/lib/roles";
import { suivreJoueur } from "@/lib/watchlist-actions";
import { classeCarte } from "@/lib/ui";
import SectionTitre from "@/components/ui/SectionTitre";
import CrestPalier from "@/components/ui/CrestPalier";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Recherche de joueurs — Najarena",
  robots: { index: false, follow: false },
};

interface RecherchePageProps {
  searchParams: Promise<{
    role?: string;
    region?: string;
    palier_min?: string;
    disponible?: string;
    erreur?: string;
    message?: string;
  }>;
}

export default async function RecherchePage({ searchParams }: RecherchePageProps) {
  const { role, region, palier_min: palierMinNom, disponible, erreur, message } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { offre } = await chargerOffre(supabase, userData.user.id);
  if (offre !== "organisateur") {
    redirect(
      `/tarifs?erreur=${encodeURIComponent("La recherche de joueurs demande l'offre Organisateur.")}`,
    );
  }

  // Indépendantes l'une de l'autre — lancées en parallèle plutôt qu'en
  // série (même logique que sur l'accueil et /lol/coequipiers).
  const [{ data: paliersData }, { data: saison }, { data: comptesData }, { data: disponiblesData }, { data: watchlistData }] =
    await Promise.all([
      supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
      supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
      supabase
        .from("game_accounts")
        .select("profile_id, region, role_prefere, profile:profiles(pseudo, slug)")
        .eq("game_id", 1)
        .eq("est_principal", true)
        .order("derniere_sync_le", { ascending: false, nullsFirst: false })
        .limit(200),
      supabase.from("recherches_coequipiers").select("profile_id"),
      supabase.from("watchlist").select("joueur_suivi_id").eq("recruteur_id", userData.user.id),
    ]);

  const paliers: Palier[] = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const comptes = comptesData ?? [];
  const profileIdsDisponibles = new Set((disponiblesData ?? []).map((d) => d.profile_id));
  const profileIdsSuivis = new Set((watchlistData ?? []).map((w) => w.joueur_suivi_id));

  let ratingsParJoueur = new Map<string, number>();
  if (saison && comptes.length > 0) {
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select("profile_id, rating")
      .eq("game_id", 1)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .in("profile_id", comptes.map((c) => c.profile_id));

    ratingsParJoueur = new Map((ratingsData ?? []).map((r) => [r.profile_id, r.rating]));
  }

  const palierMin = paliers.find((p) => p.nom === palierMinNom);

  const resultats = comptes
    .filter((c) => c.profile)
    .filter((c) => !role || c.role_prefere === role)
    .filter((c) => !region || c.region === region)
    .filter((c) => !disponible || profileIdsDisponibles.has(c.profile_id))
    .filter((c) => {
      if (!palierMin) return true;
      const rating = ratingsParJoueur.get(c.profile_id);
      return rating !== undefined && rating >= palierMin.ratingMin;
    })
    .map((c) => {
      const rating = ratingsParJoueur.get(c.profile_id);
      const { palier, progression } = rating !== undefined ? progressionPalier(rating, paliers) : { palier: null, progression: 0 };
      return {
        profileId: c.profile_id,
        pseudo: c.profile!.pseudo,
        slug: c.profile!.slug,
        region: c.region,
        role: c.role_prefere as Role | null,
        disponible: profileIdsDisponibles.has(c.profile_id),
        suivi: profileIdsSuivis.has(c.profile_id),
        palier,
        progression,
      };
    })
    .sort((a, b) => (b.palier && a.palier ? 0 : a.palier ? -1 : b.palier ? 1 : 0));

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative mx-auto max-w-contenu px-gouttiere">
        <Apparition>
          <Link
            href="/lol"
            className="font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← League of Legends
          </Link>
          <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text">
            Recherche de joueurs
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Filtre par rôle, palier, région et disponibilité — réservé à l&apos;offre Organisateur.
          </p>
        </Apparition>

        {erreur && (
          <p className={"mt-4 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
        )}
        {message && (
          <p className={"mt-4 " + classeCarte("atteste") + " text-sm text-accent"}>{message}</p>
        )}

        <Apparition delai={0.1}>
          <form className="mt-6 flex flex-wrap gap-3">
            <select
              name="role"
              defaultValue={role ?? ""}
              className="rounded-[3px] border border-line bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">Tous les rôles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {LABEL_ROLE[r]}
                </option>
              ))}
            </select>
            <select
              name="region"
              defaultValue={region ?? ""}
              className="rounded-[3px] border border-line bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">Toutes régions</option>
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.nom}
                </option>
              ))}
            </select>
            <select
              name="palier_min"
              defaultValue={palierMinNom ?? ""}
              className="rounded-[3px] border border-line bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">Palier minimum</option>
              {paliers.map((p) => (
                <option key={p.nom} value={p.nom}>
                  {p.nom}+
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-[3px] border border-line bg-surface px-3 py-2 text-sm text-text">
              <input type="checkbox" name="disponible" value="1" defaultChecked={disponible === "1"} className="accent-accent" />
              Disponible pour une équipe
            </label>
            <button
              type="submit"
              className="rounded-[3px] bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:brightness-110"
            >
              Filtrer
            </button>
          </form>
        </Apparition>

        <Apparition delai={0.15}>
          <section className="mt-8">
            <SectionTitre>{resultats.length} joueur{resultats.length !== 1 ? "s" : ""}</SectionTitre>
            {resultats.length === 0 ? (
              <div className="mt-3">
                <EtatVide illustration={<IllustrationEffectifVide />}>
                  Aucun joueur ne correspond à ces critères.
                </EtatVide>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {resultats.map((r) => (
                  <li key={r.profileId} className={"flex items-center justify-between gap-3 " + classeCarte("none")}>
                    <div className="min-w-0">
                      <Link href={`/joueur/${r.slug}`} className="text-sm font-semibold text-text hover:underline">
                        {r.pseudo}
                      </Link>
                      <div className="mt-0.5 font-texte tabular-nums text-[0.68rem] text-muted">
                        {r.role ? LABEL_ROLE[r.role] : "Rôle non renseigné"} · {r.region}
                        {r.disponible && <span className="text-accent"> · Disponible</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {r.palier ? (
                        <CrestPalier
                          nom={r.palier.nom}
                          couleur={COULEUR_PALIER[r.palier.nom.toLowerCase()] ?? "var(--color-muted)"}
                          progression={r.progression}
                        />
                      ) : (
                        <span className="font-texte tabular-nums text-[0.66rem] text-muted">Non classé</span>
                      )}
                      {r.suivi ? (
                        <span className="font-texte tabular-nums text-[0.62rem] text-accent uppercase">Suivi</span>
                      ) : (
                        <form action={suivreJoueur}>
                          <input type="hidden" name="joueur_suivi_id" value={r.profileId} />
                          <input type="hidden" name="retour" value="/lol/recherche" />
                          <button
                            type="submit"
                            className="rounded-[3px] border border-line px-2.5 py-1 font-texte tabular-nums text-[0.62rem] text-text transition hover:border-text"
                          >
                            Suivre
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Apparition>
      </div>
    </main>
  );
}
