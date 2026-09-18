import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { publierRechercheCoequipier, retirerRechercheCoequipier } from "@/lib/coequipier-actions";
import { inviterMembre } from "@/lib/equipe-actions";
import { TAILLE_MAX_EQUIPE } from "@/lib/equipe";
import { progressionPalier, type Palier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { chargerOffres, ORDRE_OFFRE, LABEL_OFFRE, COULEUR_OFFRE } from "@/lib/offres";
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import SectionTitre from "@/components/ui/SectionTitre";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import CrestPalier from "@/components/ui/CrestPalier";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";

export const metadata: Metadata = {
  title: "Trouver un coéquipier — Najarena",
  description:
    "Recherche de coéquipiers pour former une équipe 5v5 sur Najarena (tournois 5v5 bientôt) — publie une annonce ou invite un joueur disponible dans ton équipe.",
};

interface CoequipiersPageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

async function chargerCoequipiers() {
  const supabase = await createClient();

  // Indépendantes l'une de l'autre — lancées en parallèle plutôt qu'en
  // série (correctif du 13/09/2026, même logique que sur l'accueil). La
  // saison et les paliers (game_id=1, seul jeu actif) suivent la même
  // logique que /lol/classement, pour afficher le palier de chaque joueur
  // disponible — l'équivalent du matching par Elo réel, sans reconstruire
  // un algorithme d'appariement.
  const [{ data: userData }, { data: annoncesData }, { data: saison }, { data: paliersData }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("recherches_coequipiers")
        .select("profile_id, message, cree_le, profile:profiles(pseudo, slug)")
        .order("cree_le", { ascending: false }),
      supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
      supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
    ]);

  const annonces = annoncesData ?? [];
  const paliers: Palier[] = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  let ratingsParJoueur = new Map<string, { rating: number; palier: ReturnType<typeof progressionPalier> }>();
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
      (ratingsData ?? []).map((r) => [r.profile_id, { rating: r.rating, palier: progressionPalier(r.rating, paliers) }]),
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

  return {
    annonces: annoncesTriees,
    ratingsParJoueur,
    offresParJoueur,
    monAnnonce,
    mesEquipesAvecPlace,
    utilisateur: userData.user,
  };
}

export default async function CoequipiersPage({ searchParams }: CoequipiersPageProps) {
  const { erreur, message } = await searchParams;
  const { annonces, ratingsParJoueur, offresParJoueur, monAnnonce, mesEquipesAvecPlace, utilisateur } =
    await chargerCoequipiers();

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
      <Reveal>
      <Link
        href="/lol"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← League of Legends
      </Link>

      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-encre">
        Trouver un coéquipier
      </h1>
      <p className="mt-2 max-w-lg text-sm text-ardoise">
        Pour jouer en 5v5 (les tournois 5v5 ouvriront bientôt) — une équipe compte jusqu&apos;à{" "}
        {TAILLE_MAX_EQUIPE} joueurs. Publie une annonce pour te rendre visible, ou invite directement un joueur disponible dans une équipe
        où il reste de la place.{" "}
        <Link href="/equipe/nouvelle" className="text-encre underline underline-offset-3">
          Créer une équipe
        </Link>
        .
      </p>
      </Reveal>

      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
      )}
      {message && (
        <p className={"mt-6 " + classeCarte("atteste") + " text-sm text-atteste"}>{message}</p>
      )}

      {utilisateur ? (
        <form action={publierRechercheCoequipier} className={"mt-6 flex flex-col gap-2 " + classeCarte("none")}>
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            {monAnnonce ? "Modifier mon annonce" : "Se déclarer disponible"}
          </span>
          <textarea
            name="message"
            rows={2}
            maxLength={200}
            defaultValue={monAnnonce?.message ?? ""}
            placeholder="Ex. « Support, dispo le soir, cherche une équipe régulière »"
            className="resize-none rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
          <div className="flex items-center gap-3">
            <Bouton libelleEnCours="Envoi…">
              {monAnnonce ? "Mettre à jour" : "Publier mon annonce"}
            </Bouton>
            {monAnnonce && (
              <button
                type="submit"
                formAction={retirerRechercheCoequipier}
                className="font-mono text-[0.66rem] text-sceau-texte underline underline-offset-3"
              >
                Retirer mon annonce
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className={"mt-6 " + classeCarte("none") + " text-sm text-ardoise"}>
          <Link href="/connexion" className="text-encre underline underline-offset-3">
            Connecte-toi
          </Link>{" "}
          pour publier une annonce ou inviter un joueur dans ton équipe.
        </p>
      )}

      <Reveal delai={0.1}>
      <section className="mt-10">
        <SectionTitre>Joueurs disponibles</SectionTitre>
        {annonces.length === 0 ? (
          <div className="mt-3">
            <EtatVide illustration={<IllustrationEffectifVide />}>
              Personne ne s&apos;est encore déclaré disponible.
            </EtatVide>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {annonces.map((a) => (
              <li key={a.profile_id} className={classeCarte("none")}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-encre">
                    {a.profile ? (
                      <Link href={`/joueur/${a.profile.slug}`} className="hover:underline">
                        {a.profile.pseudo}
                      </Link>
                    ) : (
                      "Joueur inconnu"
                    )}
                    {(() => {
                      const offre = offresParJoueur.get(a.profile_id)?.offre;
                      return offre && offre !== "gratuit" ? (
                        <span
                          className="rounded-full border border-trait px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.06em] uppercase"
                          style={{ color: COULEUR_OFFRE[offre] }}
                        >
                          {LABEL_OFFRE[offre]}
                        </span>
                      ) : null;
                    })()}
                  </span>
                  {(() => {
                    const info = ratingsParJoueur.get(a.profile_id);
                    const palier = info?.palier.palier;
                    return palier ? (
                      <CrestPalier
                        nom={palier.nom}
                        couleur={COULEUR_PALIER[palier.nom.toLowerCase()] ?? "var(--color-ardoise)"}
                        progression={info.palier.progression}
                      />
                    ) : null;
                  })()}
                </div>
                {a.message && <p className="mt-1 text-sm text-ardoise">{a.message}</p>}

                {utilisateur?.id !== a.profile_id && mesEquipesAvecPlace.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-trait pt-3">
                    {mesEquipesAvecPlace.map((e) => (
                      <form action={inviterMembre} key={e.id}>
                        <input type="hidden" name="team_id" value={e.id} />
                        <input type="hidden" name="slug" value={e.slug} />
                        <input type="hidden" name="pseudo" value={a.profile?.pseudo ?? ""} />
                        <button
                          type="submit"
                          aria-label={`Inviter ${a.profile?.pseudo ?? "ce joueur"} dans ${e.nom}`}
                          className="rounded-[3px] border border-trait px-3 py-1.5 font-mono text-[0.64rem] text-encre transition hover:border-encre"
                        >
                          Inviter dans {e.tag} {e.nom}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      </Reveal>
      </div>
    </main>
  );
}
