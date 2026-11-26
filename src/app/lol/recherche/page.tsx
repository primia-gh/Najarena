import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { chargerOffre } from "@/lib/offres";
import { arrondir, calibrationPct, trouverPalier, type Palier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { REGIONS } from "@/lib/regions";
import { ROLES, LABEL_ROLE } from "@/lib/roles";
import {
  ACTIVITES_JOURS,
  filtresActifs,
  formaterProgression,
  LABEL_TRI,
  lireFiltres,
  resumeActivite,
  resumeFiabilite,
  TRIS,
  type Filtres,
  type ParametresRecherche,
} from "@/lib/recherche";
import { suivreJoueur } from "@/lib/watchlist-actions";
import { classeBoutonContour, classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import EtatVide from "@/components/design/EtatVide";
import EnTetePage from "@/components/design/EnTetePage";
import BoutonLien from "@/components/design/BoutonLien";
import { typographie } from "@/lib/typographie";
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

const LIMITE_RESULTATS = 100;

const PARAMETRES_FILTRES = [
  "role",
  "region",
  "palier_min",
  "rating_min",
  "classes",
  "disponible",
  "sans_equipe",
  "actif",
  "progression",
  "fiable",
  "tri",
] as const;

// Cases « Seulement les joueurs… » du formulaire.
const CASES: { nom: string; libelle: string; coche: (f: Filtres) => boolean }[] = [
  { nom: "classes", libelle: "Classés (niveau confirmé)", coche: (f) => f.classesSeulement },
  { nom: "progression", libelle: "En progression (points gagnés en tournoi classé, 30 jours)", coche: (f) => f.enProgression },
  { nom: "fiable", libelle: "Fiables (3 matchs 1v1 au moins, aucun forfait, check-in d'au moins 80 %)", coche: (f) => f.fiable },
  { nom: "disponible", libelle: "Qui cherchent une équipe", coche: (f) => f.disponible },
  { nom: "sans_equipe", libelle: "Sans équipe", coche: (f) => f.sansEquipe },
];

export const metadata: Metadata = {
  title: "Recherche de joueurs — Najarena",
  robots: { index: false, follow: false },
};

interface RecherchePageProps {
  searchParams: Promise<
    ParametresRecherche & {
      demande?: string;
      ignores?: string;
      erreur?: string;
      message?: string;
    }
  >;
}

// Hors du composant (règle de pureté du rendu).
function maintenantMs(): number {
  return Date.now();
}

export default async function RecherchePage({ searchParams }: RecherchePageProps) {
  const params = await searchParams;
  const { demande, ignores, erreur, message } = params;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion?suite=%2Flol%2Frecherche");
  }

  const { offre } = await chargerOffre(supabase, userData.user.id);
  if (offre !== "organisateur") {
    redirect(
      `/tarifs?erreur=${encodeURIComponent("La recherche de joueurs demande l'offre Organisateur.")}`,
    );
  }

  const { data: paliersData } = await supabase.from("tiers").select("nom, rating_min").eq("game_id", 1);
  const paliers: Palier[] = (paliersData ?? [])
    .map((p) => ({ nom: p.nom, ratingMin: p.rating_min }))
    .sort((a, b) => a.ratingMin - b.ratingMin);
  const filtres = lireFiltres(params, paliers);

  // Recherche faite par la base (rechercher_joueurs, 18/11/2026) : tous les
  // comptes Riot vérifiés, données vérifiées seulement.
  const [{ data: resultatsData, error: erreurRecherche }, { data: watchlistData }] = await Promise.all([
    supabase.rpc("rechercher_joueurs", {
      p_role: filtres.role,
      p_region: filtres.region,
      p_rating_min: filtres.ratingMin,
      p_classes_seulement: filtres.classesSeulement,
      p_disponible: filtres.disponible,
      p_sans_equipe: filtres.sansEquipe,
      p_actif_jours: filtres.actifJours,
      p_en_progression: filtres.enProgression,
      p_fiable: filtres.fiable,
      p_tri: filtres.tri,
      p_limite: LIMITE_RESULTATS,
    }),
    supabase.from("watchlist").select("joueur_suivi_id").eq("recruteur_id", userData.user.id),
  ]);
  const profileIdsSuivis = new Set((watchlistData ?? []).map((w) => w.joueur_suivi_id));
  const maintenant = maintenantMs();

  const resultats = (resultatsData ?? []).map((r) => ({
    profileId: r.profile_id,
    pseudo: r.pseudo,
    slug: r.slug,
    avatarUrl: r.avatar_url,
    region: r.region,
    role: ROLES.find((x) => x === r.role_prefere) ?? null,
    rating: r.rating !== null ? arrondir(r.rating) : null,
    confiance: r.rd !== null ? calibrationPct(r.rd) : null,
    palier: r.rating !== null ? (trouverPalier(r.rating, paliers)?.nom ?? null) : null,
    progression: formaterProgression(r.progression_30j),
    tournois30j: r.tournois_30j,
    activite: resumeActivite(r.parties_90j, r.derniere_partie, maintenant),
    fiabilite: resumeFiabilite(r),
    chercheEquipe: r.cherche_equipe,
    chercheDuo: r.cherche_duo,
    enEquipe: r.en_equipe,
    suivi: profileIdsSuivis.has(r.profile_id),
  }));
  const palierActuel = paliers.find((p) => p.nom === params.palier_min)?.nom ?? "";
  const ratingPrecis = params.rating_min && /^\d{1,4}$/.test(params.rating_min) ? params.rating_min : null;
  const actifs = filtresActifs(filtres);
  // Adresse de la recherche en cours : « Suivre » y ramène, filtres compris.
  const courants = new URLSearchParams();
  for (const cle of PARAMETRES_FILTRES) {
    const valeur = params[cle];
    if (valeur) courants.set(cle, valeur);
  }
  const adresseCourante = courants.toString() ? `/lol/recherche?${courants.toString()}` : "/lol/recherche";
  const ia = iaDisponible();
  const moi = userData.user.id;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille">
        <EnTetePage
          retour={{ href: "/moi", libelle: "Mon compte" }}
          surtitre="Offre Organisateur"
          titre="Recherche de joueurs"
          intro={typographie(
            "Parmi tous les comptes Riot vérifiés. Niveau, progression, activité et fiabilité sont lus dans des parties vérifiées ; seuls le poste et les annonces « cherche une équipe » ou « cherche un duo » sont déclarés par le joueur.",
          )}
          aside={
            <BoutonLien href="/moi/watchlist" variante="contour">
              Ma watchlist
            </BoutonLien>
          }
        />

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
                    placeholder={typographie("Ex. « un mid EUW au-dessus de 1 700 qui cherche une équipe »")}
                    className={`${classeChamp()} resize-none`}
                  />
                </label>
                <BoutonEnvoi libelleEnCours="Traduction…" className="self-start">
                  Rechercher
                </BoutonEnvoi>
              </form>
              <p className="text-xs text-muted">
                L&apos;IA traduit ta demande en filtres (rôle, région, rating, activité, progression, fiabilité, disponibilité) ; la recherche ne porte que
                sur des comptes Riot vérifiés. Ce que Najarena ne sait pas n&apos;est jamais deviné.
              </p>
            </Panneau>
          )}

          <Panneau className="p-6">
            <form className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-texte text-mini font-medium text-muted uppercase">Poste</span>
                  <select name="role" defaultValue={filtres.role ?? ""} className={classeChamp()}>
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
                  <select name="region" defaultValue={filtres.region ?? ""} className={classeChamp()}>
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
                  <select name="palier_min" defaultValue={palierActuel} className={classeChamp()}>
                    <option value="">Aucun</option>
                    {paliers.map((p) => (
                      <option key={p.nom} value={p.nom}>
                        {p.nom}+
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-texte text-mini font-medium text-muted uppercase">Actif</span>
                  <select name="actif" defaultValue={filtres.actifJours ? String(filtres.actifJours) : ""} className={classeChamp()}>
                    <option value="">Peu importe</option>
                    {ACTIVITES_JOURS.map((j) => (
                      <option key={j} value={j}>
                        Partie vérifiée ces {j} derniers jours
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-texte text-mini font-medium text-muted uppercase">Trier par</span>
                  <select name="tri" defaultValue={filtres.tri} className={classeChamp()}>
                    {TRIS.map((t) => (
                      <option key={t} value={t}>
                        {LABEL_TRI[t]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {ratingPrecis && <input type="hidden" name="rating_min" value={ratingPrecis} />}
              <fieldset className="grid gap-x-6 sm:grid-cols-2">
                <legend className="mb-2 font-texte text-mini font-medium text-muted uppercase">Seulement les joueurs</legend>
                {CASES.map((c) => (
                  <label key={c.nom} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-2">
                    <input
                      type="checkbox"
                      name={c.nom}
                      value="1"
                      defaultChecked={c.coche(filtres)}
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                    {c.libelle}
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <button type="submit" className={classeBoutonContour()}>
                  Filtrer
                </button>
                {actifs && (
                  <Link
                    href="/lol/recherche"
                    className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-3 hover:text-text"
                  >
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
                filtres.role ? LABEL_ROLE[filtres.role] : null,
                filtres.region,
                filtres.ratingMin ? `rating ${filtres.ratingMin} et plus` : null,
                ...CASES.filter((c) => c.coche(filtres)).map((c) => c.libelle.toLowerCase()),
                filtres.actifJours ? `actif ces ${filtres.actifJours} jours` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "aucun filtre"}
            </span>
            {ignores && <span className="mt-1 block text-xs text-muted">Non pris en compte (donnée absente) : {ignores}</span>}
          </p>
        )}

        <Apparition delai={0.1}>
          <section aria-labelledby="recherche-resultats" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-strong pb-4">
              <LibelleSection as="h2" id="recherche-resultats">
                {erreurRecherche ? "Résultats" : `${resultats.length} joueur${resultats.length !== 1 ? "s" : ""}`}
              </LibelleSection>
              {resultats.length === LIMITE_RESULTATS && (
                <span className="text-xs text-muted">Les {LIMITE_RESULTATS} premiers : affine les filtres pour aller plus loin.</span>
              )}
            </div>
            {erreurRecherche ? (
              <Alerte type="erreur">
                {erreurRecherche.message.includes("LIMITE_ATTEINTE")
                  ? "Tu as lancé 120 recherches en une heure, le maximum : réessaie un peu plus tard."
                  : "La recherche est indisponible pour l'instant : réessaie dans un moment."}
              </Alerte>
            ) : resultats.length === 0 ? (
              <EtatVide
                titre="Aucun joueur."
                actions={
                  actifs && (
                    <BoutonLien href="/lol/recherche" variante="secondaire">
                      Réinitialiser les filtres
                    </BoutonLien>
                  )
                }
              >
                {typographie("Personne ne correspond à tous ces critères : élargis la recherche en retirant un filtre.")}
              </EtatVide>
            ) : (
              <Tableau legende="Joueurs correspondant à la recherche">
                <thead>
                  <tr>
                    <th scope="col">Joueur</th>
                    <th scope="col" className="hidden sm:table-cell">
                      Poste · région
                    </th>
                    <th scope="col" className="text-right!">
                      Rating
                    </th>
                    <th scope="col" className="hidden text-right! md:table-cell">
                      30 jours
                    </th>
                    <th scope="col" className="hidden lg:table-cell">
                      Activité
                    </th>
                    <th scope="col" className="hidden xl:table-cell">
                      Fiabilité
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
                            <span className="text-xs font-normal text-text-2">
                              {[
                                r.chercheEquipe ? "Cherche une équipe" : null,
                                r.chercheDuo ? "Cherche un duo" : null,
                                r.enEquipe ? "En équipe" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {/* Petits écrans : les colonnes masquées, en une ligne. */}
                            <span className="text-xs font-normal text-muted tabular-nums md:hidden">
                              {[
                                r.role ? LABEL_ROLE[r.role] : null,
                                r.region,
                                r.progression !== null ? `${r.progression} sur 30 j` : null,
                                r.activite,
                                r.fiabilite,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            <span className="hidden text-xs font-normal text-muted tabular-nums md:block xl:hidden">
                              {[r.activite, r.fiabilite].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden py-3! text-sm text-text-2 sm:table-cell">
                        {r.role ? LABEL_ROLE[r.role] : "—"} · {r.region}
                      </td>
                      <td className="py-3! text-right">
                        {r.rating !== null ? (
                          <span className="flex flex-col items-end gap-0.5">
                            <span className="font-titre text-2xl font-extrabold tabular-nums">{r.rating}</span>
                            <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted tabular-nums">
                              {r.palier && (
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: COULEUR_PALIER[r.palier.toLowerCase()] ?? "var(--color-muted)" }}
                                />
                              )}
                              {r.palier ?? ""}
                              {r.confiance !== null ? ` · confiance ${r.confiance} %` : ""}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-faint">Non classé</span>
                        )}
                      </td>
                      <td className="hidden py-3! text-right text-sm tabular-nums md:table-cell">
                        {r.progression !== null ? (
                          <span className="flex flex-col items-end">
                            <span className="font-semibold text-text">{r.progression}</span>
                            <span className="text-xs text-muted">
                              {r.tournois30j} tournoi{r.tournois30j > 1 ? "s" : ""}
                            </span>
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="hidden py-3! text-sm text-text-2 tabular-nums lg:table-cell">{r.activite}</td>
                      <td className="hidden py-3! text-sm text-text-2 tabular-nums xl:table-cell">
                        {r.fiabilite ?? <span className="text-faint">Trop peu de matchs</span>}
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
                            <input type="hidden" name="retour" value={adresseCourante} />
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
            <p className="text-xs text-muted">
              Le rating, la confiance et la progression (somme des variations du registre sur 30 jours) ne sont donnés que pour
              un joueur classé. L&apos;activité compte les parties dont le résultat a été lu chez Riot ; la fiabilité reprend le
              bloc du CV (matchs 1v1). Seuls le poste et les annonces (équipe, duo) sont déclarés par le joueur.
            </p>
          </section>
        </Apparition>
      </div>
    </main>
  );
}
