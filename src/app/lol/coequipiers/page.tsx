import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { publierRechercheCoequipier, retirerRechercheCoequipier } from "@/lib/coequipier-actions";
import { inviterMembre } from "@/lib/equipe-actions";
import { TAILLE_MAX_EQUIPE } from "@/lib/equipe";
import { arrondir, trouverPalier, type Palier } from "@/lib/classement";
import { classeBoutonContour, classeChamp } from "@/lib/design";
import { chargerOffres, ORDRE_OFFRE } from "@/lib/offres";
import { formaterDate } from "@/lib/tournois";
import { LIBELLE_TYPE_ECHEANCE, typeEcheance } from "@/lib/echeances";
import { LABEL_ROLE, ROLES, type Role } from "@/lib/roles";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import CarteJoueurDisponible from "@/components/coequipiers/CarteJoueurDisponible";

export const metadata: Metadata = {
  title: "Trouver un coéquipier — Najarena",
  description:
    "Recherche de coéquipiers pour former une équipe 5v5 sur Najarena et jouer les tournois 5v5 — publie une annonce ou invite un joueur disponible dans ton équipe.",
};

interface CoequipiersPageProps {
  searchParams: Promise<{ erreur?: string; message?: string; objectif?: string }>;
}

// Hors du composant : la date courante ne se lit pas pendant le rendu.
function maintenantIso(): string {
  return new Date().toISOString();
}

async function chargerCoequipiers() {
  const supabase = await createClient();

  // Indépendantes l'une de l'autre — lancées en parallèle plutôt qu'en
  // série (correctif du 13/09/2026, même logique que sur l'accueil). La
  // saison et les paliers (game_id=1, seul jeu actif) suivent la même
  // logique que /lol/classement, pour afficher le palier de chaque joueur
  // disponible — l'équivalent du matching par Elo réel, sans reconstruire
  // un algorithme d'appariement.
  const [
    { data: userData },
    { data: annoncesData },
    { data: saison },
    { data: paliersData },
    { data: echeancesData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("recherches_coequipiers")
      .select(
        "profile_id, message, cree_le, objectif_id, profile:profiles(pseudo, slug, avatar_url, game_accounts(role_prefere, region, est_principal))",
      )
      .order("cree_le", { ascending: false }),
    supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
    // Prochaines échéances (audit N24) : Clash lu chez Riot, Nexus Tour saisi
    // avec son lien officiel.
    supabase
      .from("echeances")
      .select("id, type, nom, debut_le, lien_officiel, region")
      .gt("debut_le", maintenantIso())
      .order("debut_le", { ascending: true })
      .limit(8),
  ]);

  const annonces = annoncesData ?? [];
  const paliers: Palier[] = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  let ratingsParJoueur = new Map<string, { rating: number; palier: string | null }>();
  if (saison && annonces.length > 0) {
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select("profile_id, rating, est_classe")
      .eq("game_id", 1)
      .eq("season_id", saison.id)
      .eq("est_classe", true)
      .in(
        "profile_id",
        annonces.map((a) => a.profile_id),
      );

    ratingsParJoueur = new Map(
      (ratingsData ?? []).map((r) => [
        r.profile_id,
        { rating: arrondir(r.rating), palier: trouverPalier(r.rating, paliers)?.nom ?? null },
      ]),
    );
  }

  const offresParJoueur = await chargerOffres(
    supabase,
    annonces.map((a) => a.profile_id),
  );

  // Offre payante d'abord (Vérifié/Elite/Organisateur), puis classés du
  // meilleur rating au plus modeste, non-classés en dernier.
  const annoncesTriees = [...annonces].sort((a, b) => {
    const oa = ORDRE_OFFRE[offresParJoueur.get(a.profile_id)?.offre ?? "gratuit"];
    const ob = ORDRE_OFFRE[offresParJoueur.get(b.profile_id)?.offre ?? "gratuit"];
    if (oa !== ob) return ob - oa;

    const ra = ratingsParJoueur.get(a.profile_id)?.rating;
    const rb = ratingsParJoueur.get(b.profile_id)?.rating;
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return rb - ra;
  });

  const monAnnonce = userData.user
    ? annonces.find((a) => a.profile_id === userData.user!.id)
    : undefined;

  let mesEquipesAvecPlace: Array<{ id: string; slug: string; nom: string; tag: string }> = [];
  if (userData.user) {
    const { data: equipesData } = await supabase
      .from("teams")
      .select("id, slug, nom, tag, team_members(accepte_le)")
      .eq("capitaine_id", userData.user.id);

    mesEquipesAvecPlace = (equipesData ?? [])
      .filter((e) => e.team_members.filter((m) => m.accepte_le !== null).length < TAILLE_MAX_EQUIPE)
      .map((e) => ({ id: e.id, slug: e.slug, nom: e.nom, tag: e.tag }));
  }

  const echeances = echeancesData ?? [];
  return {
    annonces: annoncesTriees,
    ratingsParJoueur,
    offresParJoueur,
    monAnnonce,
    mesEquipesAvecPlace,
    utilisateur: userData.user,
    echeances,
    // Joueurs qui visent chaque échéance.
    candidatsParEcheance: new Map(
      echeances.map((e) => [e.id, annonces.filter((a) => a.objectif_id === e.id).length]),
    ),
  };
}

export default async function CoequipiersPage({ searchParams }: CoequipiersPageProps) {
  const { erreur, message, objectif } = await searchParams;
  const {
    annonces: toutesLesAnnonces,
    ratingsParJoueur,
    offresParJoueur,
    monAnnonce,
    mesEquipesAvecPlace,
    utilisateur,
    echeances,
    candidatsParEcheance,
  } = await chargerCoequipiers();
  const echeanceParId = new Map(echeances.map((e) => [e.id, e]));
  const echeanceFiltree = objectif ? echeanceParId.get(objectif) : undefined;
  const annonces = echeanceFiltree
    ? toutesLesAnnonces.filter((a) => a.objectif_id === echeanceFiltree.id)
    : toutesLesAnnonces;

  const formulaire = utilisateur ? (
    <form action={publierRechercheCoequipier} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-texte text-mini font-medium text-muted uppercase">
          {monAnnonce ? "Mon annonce" : "Ton annonce · 200 caractères"}
        </span>
        <textarea
          name="message"
          rows={3}
          maxLength={200}
          defaultValue={monAnnonce?.message ?? ""}
          placeholder="Ex. « Support, dispo le soir, cherche une équipe régulière »"
          className={`${classeChamp()} resize-none`}
        />
      </label>
      {echeances.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="font-texte text-mini font-medium text-muted uppercase">Objectif</span>
          <select
            name="objectif_id"
            defaultValue={monAnnonce?.objectif_id && echeanceParId.has(monAnnonce.objectif_id) ? monAnnonce.objectif_id : ""}
            className={classeChamp()}
          >
            <option value="">Une équipe régulière, pas d&apos;échéance précise</option>
            {echeances.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom} — {formaterDate(e.debut_le)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <BoutonEnvoi libelleEnCours="Envoi…" className="w-full sm:w-auto">
          {monAnnonce ? "Mettre à jour" : "Publier mon annonce"}
        </BoutonEnvoi>
        {monAnnonce && (
          <button
            type="submit"
            formAction={retirerRechercheCoequipier}
            className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
          >
            Retirer mon annonce
          </button>
        )}
      </div>
    </form>
  ) : (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-text-2">Connecte-toi pour publier une annonce ou inviter un joueur dans ton équipe.</p>
      <BoutonLien href="/connexion?suite=/lol/coequipiers" variante="contour">
        Se connecter
      </BoutonLien>
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <LibelleSection>League of Legends · 5v5</LibelleSection>
            <h1 className="mt-4 font-titre text-section font-black tracking-[1px] uppercase">Trouver un coéquipier</h1>
            <p className="mt-5 max-w-2xl text-courant text-text-2">
              Une équipe compte jusqu&apos;à {TAILLE_MAX_EQUIPE} joueurs ; son capitaine en inscrit cinq aux tournois
              5v5. Publie une annonce pour te rendre visible, ou invite un joueur disponible dans ton équipe.
            </p>
          </div>
          <BoutonLien href="/equipe/nouvelle" variante="contour">
            Créer une équipe
          </BoutonLien>
        </Apparition>

        {(erreur || message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            {message && <Alerte type="succes">{message}</Alerte>}
          </div>
        )}

        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Apparition delai={0.08}>
            <section aria-labelledby="coequipiers-disponibles" className="flex flex-col gap-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-strong pb-4">
                <LibelleSection as="h2" id="coequipiers-disponibles">
                  {echeanceFiltree ? `Disponibles — ${echeanceFiltree.nom}` : "Joueurs disponibles"}{" "}
                  <span className="text-faint tabular-nums">· {annonces.length}</span>
                </LibelleSection>
                {echeanceFiltree && (
                  <Link href="/lol/coequipiers" className="text-sm text-muted underline underline-offset-3 hover:text-text">
                    Voir toutes les annonces
                  </Link>
                )}
              </div>
              {annonces.length === 0 ? (
                <Panneau reperes className="flex flex-col items-start gap-3 p-8">
                  <p className="font-titre text-3xl font-black uppercase">Personne pour l&apos;instant.</p>
                  <p className="max-w-md text-text-2">
                    Aucun joueur ne s&apos;est encore déclaré disponible{echeanceFiltree ? " pour cette échéance" : ""}.
                    Publie la première annonce.
                  </p>
                </Panneau>
              ) : (
                <ul className="grid gap-4 xl:grid-cols-2">
                  {annonces.map((a) => {
                    const compte =
                      a.profile?.game_accounts.find((c) => c.est_principal) ?? a.profile?.game_accounts[0] ?? null;
                    const role = compte?.role_prefere && ROLES.includes(compte.role_prefere as Role) ? (compte.role_prefere as Role) : null;
                    const info = ratingsParJoueur.get(a.profile_id);
                    const echeance = a.objectif_id ? echeanceParId.get(a.objectif_id) : undefined;
                    const offre = offresParJoueur.get(a.profile_id)?.offre;
                    return (
                      <li key={a.profile_id}>
                        <CarteJoueurDisponible
                          pseudo={a.profile?.pseudo ?? "Joueur inconnu"}
                          slug={a.profile?.slug ?? null}
                          avatarUrl={a.profile?.avatar_url ?? null}
                          role={role ? LABEL_ROLE[role] : null}
                          region={compte?.region ?? null}
                          rating={info?.rating ?? null}
                          palier={info?.palier ?? null}
                          offre={offre && offre !== "gratuit" ? offre : null}
                          message={a.message}
                          objectif={echeance ? `${echeance.nom} · ${formaterDate(echeance.debut_le)}` : null}
                          publieLe={a.cree_le}
                        >
                          {utilisateur?.id !== a.profile_id &&
                            mesEquipesAvecPlace.map((e) => (
                              <form action={inviterMembre} key={e.id}>
                                <input type="hidden" name="team_id" value={e.id} />
                                <input type="hidden" name="slug" value={e.slug} />
                                <input type="hidden" name="pseudo" value={a.profile?.pseudo ?? ""} />
                                <button
                                  type="submit"
                                  aria-label={`Inviter ${a.profile?.pseudo ?? "ce joueur"} dans ${e.nom}`}
                                  className={`${classeBoutonContour()} min-h-10! px-4! py-2! text-xs!`}
                                >
                                  Inviter dans {e.tag}
                                </button>
                              </form>
                            ))}
                        </CarteJoueurDisponible>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </Apparition>

          <Apparition delai={0.12} className="flex flex-col gap-8 lg:sticky lg:top-28">
            <Panneau className="flex flex-col gap-5 p-6">
              <LibelleSection as="h2">{monAnnonce ? "Mon annonce" : "Je cherche une équipe"}</LibelleSection>
              {formulaire}
            </Panneau>

            {echeances.length > 0 && (
              <section id="echeances" aria-labelledby="coequipiers-echeances" className="flex scroll-mt-28 flex-col gap-4">
                <LibelleSection as="h2" id="coequipiers-echeances">
                  Prochaines échéances
                </LibelleSection>
                <ul className="flex flex-col">
                  {echeances.map((e) => {
                    const candidats = candidatsParEcheance.get(e.id) ?? 0;
                    const actif = echeanceFiltree?.id === e.id;
                    return (
                      <li key={e.id} className={`flex flex-col gap-1.5 border-b border-line py-4 ${actif ? "border-l-2 border-l-text pl-3" : ""}`}>
                        <span className="font-texte text-mini font-medium text-faint uppercase">
                          {LIBELLE_TYPE_ECHEANCE[typeEcheance(e.type)]}
                          {e.region ? ` · ${e.region}` : ""} · {formaterDate(e.debut_le)}
                        </span>
                        <span className="font-semibold">{e.nom}</span>
                        <span className="flex flex-wrap items-center gap-x-4 text-sm">
                          <Link href={`/lol/coequipiers?objectif=${e.id}`} className="text-text-2 underline underline-offset-3 hover:text-text">
                            {candidats} joueur{candidats > 1 ? "s" : ""} cherche{candidats > 1 ? "nt" : ""} une équipe
                          </Link>
                          {e.lien_officiel && (
                            <a
                              href={e.lien_officiel}
                              rel="noopener noreferrer nofollow"
                              target="_blank"
                              className="text-muted underline underline-offset-3 hover:text-text"
                            >
                              Site officiel
                            </a>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted">
                  Clash est lu dans le calendrier officiel de Riot ; le Nexus Tour et les autres compétitions sont ajoutés avec
                  leur lien officiel.
                </p>
              </section>
            )}
          </Apparition>
        </div>
      </div>
    </main>
  );
}
