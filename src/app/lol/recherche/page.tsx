import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { arrondir, trouverPalier, type Palier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { REGIONS } from "@/lib/regions";
import { ROLES, LABEL_ROLE, type Role } from "@/lib/roles";
import { suivreJoueur } from "@/lib/watchlist-actions";
import { classeBoutonContour, classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";
import { iaDisponible } from "@/lib/claude";
import { rechercherEnLangageNaturel } from "@/lib/recherche-ia-actions";

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
    rating_min?: string;
    demande?: string;
    ignores?: string;
    erreur?: string;
    message?: string;
  }>;
}

export default async function RecherchePage({ searchParams }: RecherchePageProps) {
  const {
    role,
    region,
    palier_min: palierMinNom,
    disponible,
    rating_min: ratingMinBrut,
    demande,
    ignores,
    erreur,
    message,
  } = await searchParams;
  // Rating minimum précis (recherche en langage naturel, audit N29).
  const ratingMin = ratingMinBrut && /^\d{1,4}$/.test(ratingMinBrut) ? Number(ratingMinBrut) : null;

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
        .select("profile_id, region, role_prefere, profile:profiles(pseudo, slug, avatar_url)")
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
    .filter((c) => {
      if (ratingMin === null) return true;
      const rating = ratingsParJoueur.get(c.profile_id);
      return rating !== undefined && rating >= ratingMin;
    })
    .map((c) => {
      const rating = ratingsParJoueur.get(c.profile_id);
      return {
        profileId: c.profile_id,
        pseudo: c.profile!.pseudo,
        slug: c.profile!.slug,
        avatarUrl: c.profile!.avatar_url,
        region: c.region,
        role: c.role_prefere as Role | null,
        disponible: profileIdsDisponibles.has(c.profile_id),
        suivi: profileIdsSuivis.has(c.profile_id),
        rating: rating !== undefined ? arrondir(rating) : null,
        palier: rating !== undefined ? (trouverPalier(rating, paliers)?.nom ?? null) : null,
      };
    })
    // Classés du meilleur rating au plus modeste, puis les non-classés
    // (revue du 05/10/2026 : avant, les classés n'étaient pas triés entre eux).
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  const filtresActifs = Boolean(role || region || palierMinNom || disponible || ratingMin !== null);
  const ia = iaDisponible();
  const moi = userData.user.id;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        <Apparition className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Link
              href="/moi"
              className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
            >
              <Icone nom="fleche-gauche" taille={14} />
              Mon compte
            </Link>
            <LibelleSection className="mt-6">Offre Organisateur</LibelleSection>
            <h1 className="mt-3 font-titre text-sous-titre font-black uppercase">Recherche de joueurs</h1>
            <p className="mt-4 max-w-2xl text-text-2">
              Par poste, palier, région et disponibilité, parmi les comptes Riot vérifiés. Le poste est celui que le
              joueur a renseigné ; palier et rating sont ceux du classement officiel.
            </p>
          </div>
          <Link href="/moi/watchlist" className="text-sm text-text underline underline-offset-3 hover:text-accent">
            Ma watchlist
          </Link>
        </Apparition>

        {(erreur || message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        <Apparition delai={0.06} className={`grid items-start gap-6 ${ia ? "lg:grid-cols-2" : "max-w-3xl"}`}>
          {ia && (
            <Panneau className="flex flex-col gap-4 p-6">
              <form action={rechercherEnLangageNaturel} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="font-texte text-mini font-medium text-muted uppercase">Décris le joueur que tu cherches</span>
                  <textarea
                    name="demande"
                    rows={2}
                    maxLength={300}
                    defaultValue={demande ?? ""}
                    placeholder="Ex. « un mid EUW au-dessus de 1 700 qui cherche une équipe »"
                    className={`${classeChamp()} resize-none`}
                  />
                </label>
                <BoutonEnvoi libelleEnCours="Traduction…" className="self-start">
                  Rechercher
                </BoutonEnvoi>
              </form>
              <p className="text-xs text-muted">
                L&apos;IA traduit ta demande en filtres (rôle, région, rating, disponibilité) ; la recherche ne porte que
                sur des comptes Riot vérifiés. Ce que Najarena ne sait pas n&apos;est jamais deviné.
              </p>
            </Panneau>
          )}

          <Panneau className="p-6">
            <form className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-texte text-mini font-medium text-muted uppercase">Poste</span>
                  <select name="role" defaultValue={role ?? ""} className={classeChamp()}>
                    <option value="">Tous</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {LABEL_ROLE[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-texte text-mini font-medium text-muted uppercase">Région</span>
                  <select name="region" defaultValue={region ?? ""} className={classeChamp()}>
                    <option value="">Toutes</option>
                    {REGIONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.nom}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-texte text-mini font-medium text-muted uppercase">Palier minimum</span>
                  <select name="palier_min" defaultValue={palierMinNom ?? ""} className={classeChamp()}>
                    <option value="">Aucun</option>
                    {paliers.map((p) => (
                      <option key={p.nom} value={p.nom}>
                        {p.nom}+
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {ratingMin !== null && <input type="hidden" name="rating_min" value={ratingMin} />}
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-2">
                <input type="checkbox" name="disponible" value="1" defaultChecked={disponible === "1"} className="h-4 w-4 accent-accent" />
                Seulement les joueurs qui cherchent une équipe
              </label>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <button type="submit" className={classeBoutonContour()}>
                  Filtrer
                </button>
                {filtresActifs && (
                  <Link href="/lol/recherche" className="text-sm text-muted underline underline-offset-3 hover:text-text">
                    Réinitialiser
                  </Link>
                )}
              </div>
            </form>
          </Panneau>
        </Apparition>

        {demande && (
          <p className="max-w-3xl text-sm text-text-2">
            Ta demande : « {demande} » →{" "}
            <span className="text-text">
              {[
                role && ROLES.includes(role as Role) ? LABEL_ROLE[role as Role] : null,
                region || null,
                ratingMin ? `rating ${ratingMin} et plus` : null,
                disponible === "1" ? "cherche une équipe" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "aucun filtre"}
            </span>
            {ignores && <span className="mt-1 block text-xs text-muted">Non pris en compte (donnée absente) : {ignores}</span>}
          </p>
        )}

        <Apparition delai={0.1}>
          <section aria-labelledby="recherche-resultats" className="flex flex-col gap-4">
            <LibelleSection as="h2" id="recherche-resultats" className="border-b border-line-strong pb-4">
              {resultats.length} joueur{resultats.length !== 1 ? "s" : ""}
            </LibelleSection>
            {resultats.length === 0 ? (
              <p className="text-text-2">Aucun joueur ne correspond à ces critères.</p>
            ) : (
              <Tableau legende="Joueurs correspondant à la recherche">
                <thead>
                  <tr>
                    <th scope="col">Joueur</th>
                    <th scope="col" className="hidden sm:table-cell">
                      Poste
                    </th>
                    <th scope="col" className="hidden md:table-cell">
                      Région
                    </th>
                    <th scope="col" className="hidden sm:table-cell">
                      Palier
                    </th>
                    <th scope="col" className="text-right!">
                      Rating
                    </th>
                    <th scope="col" className="text-right!">
                      <span className="sr-only">Suivre</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.map((r) => (
                    <tr key={r.profileId}>
                      <td className="py-3!">
                        <Link
                          href={`/joueur/${r.slug}`}
                          className="inline-flex min-h-11 items-center gap-3 font-semibold hover:text-accent"
                        >
                          <AvatarJoueur pseudo={r.pseudo} src={r.avatarUrl} />
                          <span className="flex flex-col">
                            {r.pseudo}
                            {r.disponible && (
                              <span className="text-xs font-normal text-text-2">Cherche une équipe</span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden py-3! text-sm text-text-2 sm:table-cell">{r.role ? LABEL_ROLE[r.role] : "—"}</td>
                      <td className="hidden py-3! text-sm text-text-2 md:table-cell">{r.region}</td>
                      <td className="hidden py-3! text-sm text-text-2 sm:table-cell">
                        {r.palier ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 rounded-full"
                              style={{ background: COULEUR_PALIER[r.palier.toLowerCase()] ?? "var(--color-muted)" }}
                            />
                            {r.palier}
                          </span>
                        ) : (
                          <span className="text-faint">Non classé</span>
                        )}
                      </td>
                      <td className="py-3! text-right font-titre text-2xl font-extrabold tabular-nums">
                        {r.rating ?? <span className="font-texte text-sm font-normal text-faint">—</span>}
                      </td>
                      <td className="py-3! text-right">
                        {r.profileId === moi ? (
                          <span className="font-texte text-mini font-medium text-faint uppercase">Toi</span>
                        ) : r.suivi ? (
                          <span className="inline-flex items-center gap-1.5 font-texte text-mini font-semibold text-text-2 uppercase">
                            <Icone nom="coche" taille={13} />
                            Suivi
                          </span>
                        ) : (
                          <form action={suivreJoueur}>
                            <input type="hidden" name="joueur_suivi_id" value={r.profileId} />
                            <input type="hidden" name="retour" value="/lol/recherche" />
                            <button
                              type="submit"
                              aria-label={`Suivre ${r.pseudo}`}
                              className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-text underline underline-offset-3 hover:text-accent"
                            >
                              Suivre
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tableau>
            )}
          </section>
        </Apparition>
      </div>
    </main>
  );
}
