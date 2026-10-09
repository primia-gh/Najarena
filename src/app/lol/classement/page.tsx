import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir, trouverPalier } from "@/lib/classement";
import { formaterDate } from "@/lib/tournois";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import { EchellePaliers, Podium, TableauClassement, type JoueurClasse } from "@/components/classement/LignesClassement";

export const metadata: Metadata = {
  title: "Classement LoL — Najarena",
  description:
    "Classement League of Legends Najarena, calculé en Glicko-2 à partir de résultats vérifiés dans la donnée officielle Riot.",
};

// Revue visuelle du 05/10/2026 : podium, tableau dense, échelle des
// paliers, nombre de joueurs classés et date du dernier calcul — la page
// « preuve » du site montre d'où viennent ses chiffres. Les données et les
// règles d'entrée au classement (est_classe = RD ≤ 150) sont inchangées.

const LIMITE = 100;

export default async function ClassementPage() {
  const supabase = await createClient();

  // game_id=1 est LoL — seule ligne de `games` en V1.
  const [{ data: saison }, { data: paliersData }] = await Promise.all([
    supabase.from("seasons").select("id, nom, numero").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);
  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));

  let joueurs: JoueurClasse[] = [];
  let nombreClasses = 0;
  let dernierCalcul: string | null = null;
  let erreurClassement = false;

  if (saison) {
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from("ratings")
        .select("profile_id, rating, matchs_joues, maj_le, profile:profiles(pseudo, slug, avatar_url)")
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .eq("est_classe", true)
        .order("rating", { ascending: false })
        .limit(LIMITE),
      supabase
        .from("ratings")
        .select("profile_id", { count: "exact", head: true })
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .eq("est_classe", true),
    ]);
    if (error) erreurClassement = true;
    const lignes = (data ?? []).filter((r) => r.profile !== null);
    nombreClasses = count ?? lignes.length;
    dernierCalcul = lignes.reduce<string | null>((max, r) => (!max || r.maj_le > max ? r.maj_le : max), null);

    // Dernière variation de chaque joueur affiché (journal public, CLAUDE.md §4).
    const variations = new Map<string, number>();
    if (lignes.length > 0) {
      const { data: evenements } = await supabase
        .from("rating_events")
        .select("profile_id, rating_avant, rating_apres")
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .in(
          "profile_id",
          lignes.map((r) => r.profile_id),
        )
        .order("cree_le", { ascending: false })
        .limit(LIMITE * 6);
      for (const e of evenements ?? []) {
        if (!variations.has(e.profile_id)) variations.set(e.profile_id, arrondir(e.rating_apres - e.rating_avant));
      }
    }

    joueurs = lignes.map((r, i) => ({
      rang: i + 1,
      pseudo: r.profile!.pseudo,
      slug: r.profile!.slug,
      avatarUrl: r.profile!.avatar_url,
      rating: arrondir(r.rating),
      matchs: r.matchs_joues,
      palier: trouverPalier(r.rating, paliers)?.nom ?? null,
      variation: variations.get(r.profile_id) ?? null,
    }));
  }

  const podium = joueurs.slice(0, 3);
  const suite = joueurs.slice(3);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-14 px-grille">
        <Apparition className="flex flex-wrap items-end justify-between gap-10">
          <div>
            <LibelleSection>League of Legends{saison?.nom ? ` · ${saison.nom}` : ""}</LibelleSection>
            <h1 className="mt-4 font-titre text-section font-black tracking-[1px] uppercase">Classement</h1>
            <p className="mt-5 max-w-2xl text-courant text-text-2">
              Calculé en Glicko-2 à partir de résultats lus chez Riot, recalculé à la clôture de chaque tournoi classé. Un
              joueur y entre quand son incertitude (RD) descend sous 150 — une dizaine de matchs.
            </p>
          </div>
          {saison && !erreurClassement && joueurs.length > 0 && (
            <dl className="flex gap-10 border-l border-line-strong pl-8">
              <div className="flex flex-col gap-2">
                <dt className="font-texte text-mini font-medium text-faint uppercase">Joueurs classés</dt>
                <dd className="font-titre text-5xl leading-none font-black tabular-nums">{nombreClasses}</dd>
              </div>
              {dernierCalcul && (
                <div className="flex flex-col gap-2">
                  <dt className="font-texte text-mini font-medium text-faint uppercase">Dernier calcul</dt>
                  <dd className="font-titre text-5xl leading-none font-black tabular-nums">
                    {formaterDate(dernierCalcul).split(" ")[0]}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </Apparition>

        <Apparition delai={0.08} className="flex flex-col gap-14">
          {!saison ? (
            <Panneau reperes className="flex flex-col items-start gap-4 p-8 sm:p-10">
              <p className="font-titre text-sous-titre font-black uppercase">Le classement n&apos;est pas encore ouvert.</p>
              <p className="max-w-xl text-text-2">Aucune saison n&apos;est en cours pour l&apos;instant.</p>
              <BoutonLien href="/lol/saisons" variante="secondaire">
                Saisons et classements archivés
              </BoutonLien>
            </Panneau>
          ) : erreurClassement ? (
            <Alerte type="erreur" className="max-w-2xl">
              Impossible de charger le classement pour l&apos;instant. Réessaie dans un instant.
            </Alerte>
          ) : joueurs.length === 0 ? (
            <Panneau reperes className="flex flex-col items-start gap-4 p-8 sm:p-10">
              <p className="font-titre text-sous-titre font-black uppercase">Aucun joueur classé pour l&apos;instant.</p>
              <p className="max-w-xl text-text-2">
                L&apos;entrée au classement demande une dizaine de matchs vérifiés. Les premiers tournois classés de la
                saison feront apparaître les premiers noms.
              </p>
              <BoutonLien href="/lol/tournois" variante="secondaire">
                Voir les tournois
              </BoutonLien>
            </Panneau>
          ) : (
            <>
              <section aria-label="Podium">
                <Podium joueurs={podium} />
              </section>
              {suite.length > 0 && (
                <section aria-labelledby="classement-suite" className="flex flex-col gap-6">
                  <LibelleSection as="h2" id="classement-suite">
                    {nombreClasses > LIMITE ? `Les ${LIMITE} premiers` : "La suite du classement"}
                  </LibelleSection>
                  <TableauClassement joueurs={suite} legende={`Classement ${saison.nom ?? ""}, à partir de la 4e place`} />
                </section>
              )}
            </>
          )}

          {paliers.length > 0 && (
            <section aria-labelledby="classement-paliers" className="flex flex-col gap-6 border-t border-line pt-10">
              <LibelleSection as="h2" id="classement-paliers">
                Paliers · seuils fixes
              </LibelleSection>
              <EchellePaliers paliers={paliers} />
              <p className="max-w-2xl text-sm text-muted">
                Chaque variation de points est inscrite au{" "}
                <Link href="/registre" className="text-text underline underline-offset-3 hover:text-accent">
                  registre public
                </Link>
                , avec le rating avant et après : rien n&apos;est modifié après coup.{" "}
                <Link href="/lol/saisons" className="text-text underline underline-offset-3 hover:text-accent">
                  Saisons et classements archivés
                </Link>
                {" · "}
                <Link href="/lol/meteo" className="text-text underline underline-offset-3 hover:text-accent">
                  Météo du classement
                </Link>
                {" · "}
                <Link href="/comment-ca-marche" className="text-text underline underline-offset-3 hover:text-accent">
                  Comment ça marche
                </Link>
              </p>
            </section>
          )}
        </Apparition>
      </div>
    </main>
  );
}
