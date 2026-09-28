import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir, progressionPalier } from "@/lib/classement";
import { COULEUR_PALIER } from "@/lib/paliers";
import { dateLongue, joursRestants, libelleJoursRestants, periodeSaison } from "@/lib/saisons";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";

// Saisons visibles (28/09/2026, audit N14) : dates, jours restants, règle
// du changement de saison et classements finaux archivés. Lecture seule
// des tables publiques seasons / ratings / tiers (game_id = 1, LoL).

export const metadata: Metadata = {
  title: "Saisons LoL — Najarena",
  description:
    "Les saisons du classement League of Legends Najarena : dates, jours restants et classements finaux archivés, calculés en Glicko-2 à partir de résultats vérifiés.",
  alternates: { canonical: "/lol/saisons" },
};

const SAISONS_ARCHIVEES_MAX = 6;
const TOP_ARCHIVE = 10;

export default async function SaisonsPage() {
  const supabase = await createClient();

  const [{ data: saisonsData }, { data: paliersData }] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, numero, nom, debut_le, fin_le, est_courante")
      .eq("game_id", 1)
      .order("numero", { ascending: false }),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);

  const saisons = saisonsData ?? [];
  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const maintenant = new Date();
  const courante = saisons.find((s) => s.est_courante) ?? null;
  const aVenir = saisons.filter((s) => !s.est_courante && new Date(s.debut_le) > maintenant);
  const passees = saisons
    .filter((s) => !s.est_courante && new Date(s.debut_le) <= maintenant)
    .slice(0, SAISONS_ARCHIVEES_MAX);

  // Classement final de chaque saison passée, et nombre de classés de la
  // saison en cours : une requête par saison, peu nombreuses.
  const [{ count: classesCourante }, archives] = await Promise.all([
    courante
      ? supabase
          .from("ratings")
          .select("*", { count: "exact", head: true })
          .eq("game_id", 1)
          .eq("season_id", courante.id)
          .eq("est_classe", true)
      : Promise.resolve({ count: 0 }),
    Promise.all(
      passees.map(async (s) => {
        const [{ data: top }, { count }] = await Promise.all([
          supabase
            .from("ratings")
            .select("rating, matchs_joues, profil:profiles(pseudo, slug, supprime_le)")
            .eq("game_id", 1)
            .eq("season_id", s.id)
            .eq("est_classe", true)
            .order("rating", { ascending: false })
            .limit(TOP_ARCHIVE),
          supabase
            .from("ratings")
            .select("*", { count: "exact", head: true })
            .eq("game_id", 1)
            .eq("season_id", s.id)
            .eq("est_classe", true),
        ]);
        return { saison: s, top: top ?? [], total: count ?? 0 };
      }),
    ),
  ]);

  const jours = courante ? joursRestants(courante.fin_le, maintenant) : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">League of Legends</span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Saisons
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Chaque saison a son propre classement. Au passage à la suivante, le rating de chacun se rapproche de 15 % de
            1500 et son incertitude (RD) est multipliée par 1,8 : jamais de remise à zéro, mais une vraie place à
            reconquérir. Le classement final de chaque saison reste archivé ici, tel quel.
          </p>
        </Apparition>

        <Apparition delai={0.08}>
          <div className="mt-8 grid max-w-contenu gap-4 lg:grid-cols-[2fr_1fr]">
            <Panneau as="section" className="flex flex-col gap-3 px-6 py-6 sm:px-8">
              <LibelleSection as="h2">Saison en cours</LibelleSection>
              {courante ? (
                <>
                  <p className="font-titre text-3xl font-black uppercase">
                    {courante.nom ?? `Saison ${courante.numero}`}
                  </p>
                  <p className="text-sm text-text-2">
                    Du <span className="tabular-nums">{dateLongue(courante.debut_le)}</span> au{" "}
                    <span className="tabular-nums">{dateLongue(courante.fin_le)}</span> ·{" "}
                    <span className="font-semibold text-text tabular-nums">{libelleJoursRestants(jours)}</span>
                  </p>
                  <p className="text-sm text-muted">
                    <span className="tabular-nums">{classesCourante ?? 0}</span> joueur
                    {(classesCourante ?? 0) > 1 ? "s" : ""} classé{(classesCourante ?? 0) > 1 ? "s" : ""} pour
                    l&apos;instant.{" "}
                    <Link href="/lol/classement" className="text-text underline underline-offset-3 hover:text-accent">
                      Voir le classement
                    </Link>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">Aucune saison n&apos;est en cours pour l&apos;instant.</p>
              )}
            </Panneau>

            <Panneau as="section" className="flex flex-col gap-3 px-6 py-6">
              <LibelleSection as="h2">Prochaine saison</LibelleSection>
              {aVenir.length > 0 ? (
                <p className="text-sm text-text-2">
                  {aVenir[aVenir.length - 1].nom ?? `Saison ${aVenir[aVenir.length - 1].numero}`} — à partir du{" "}
                  <span className="tabular-nums">{dateLongue(aVenir[aVenir.length - 1].debut_le)}</span>.
                </p>
              ) : (
                <p className="text-sm text-muted">Pas encore annoncée.</p>
              )}
            </Panneau>
          </div>
        </Apparition>

        <Apparition delai={0.12}>
          <section className="mt-10 flex max-w-contenu flex-col gap-6" aria-labelledby="titre-archives">
            <LibelleSection as="h2" id="titre-archives">
              Saisons terminées
            </LibelleSection>
            {archives.length === 0 ? (
              <p className="text-sm text-muted">
                Aucune saison terminée pour l&apos;instant : le premier classement final sera archivé ici à la fin de la
                saison en cours.
              </p>
            ) : (
              archives.map(({ saison, top, total }) => (
                <div key={saison.id} className="flex flex-col gap-3">
                  <h3 className="font-titre text-2xl font-extrabold uppercase">
                    {saison.nom ?? `Saison ${saison.numero}`}{" "}
                    <span className="font-texte text-sm font-medium text-muted normal-case">
                      {periodeSaison(saison.debut_le, saison.fin_le)} ·{" "}
                      <span className="tabular-nums">{total}</span> classé{total > 1 ? "s" : ""}
                    </span>
                  </h3>
                  {top.length === 0 ? (
                    <p className="text-sm text-muted">Aucun joueur classé cette saison.</p>
                  ) : (
                    <Tableau legende={`Classement final — ${saison.nom ?? `Saison ${saison.numero}`}`}>
                      <thead>
                        <tr>
                          <th scope="col">Rang</th>
                          <th scope="col">Joueur</th>
                          <th scope="col">Palier final</th>
                          <th scope="col">Rating final</th>
                          <th scope="col">Matchs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top.map((r, i) => {
                          const palier = progressionPalier(r.rating, paliers).palier;
                          return (
                            <tr key={`${saison.id}-${i}`}>
                              <td className="tabular-nums">#{i + 1}</td>
                              <td>
                                {r.profil && !r.profil.supprime_le ? (
                                  <Link href={`/joueur/${r.profil.slug}`} className="hover:text-accent">
                                    {r.profil.pseudo}
                                  </Link>
                                ) : (
                                  "Compte supprimé"
                                )}
                              </td>
                              <td
                                style={{
                                  color: palier ? (COULEUR_PALIER[palier.nom.toLowerCase()] ?? undefined) : undefined,
                                }}
                              >
                                {palier?.nom ?? "—"}
                              </td>
                              <td className="tabular-nums">{arrondir(r.rating)}</td>
                              <td className="tabular-nums">{r.matchs_joues}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Tableau>
                  )}
                </div>
              ))
            )}
          </section>
        </Apparition>
      </div>
    </main>
  );
}
