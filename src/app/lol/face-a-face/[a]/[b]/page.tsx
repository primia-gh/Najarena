import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { arrondir, trouverPalier, type Palier } from "@/lib/classement";
import { probabiliteVictoire } from "@/lib/glicko2";
import { formaterDate } from "@/lib/tournois";
import { adresseCanonique, bilanFaceAFace, compteAuBilan, depuisLigne, horsClassementNiveau } from "@/lib/face-a-face";
import { listeFrancaise, MENTION_SANS_POINTS, matchsSansPoints, REGLE_NIVEAU_COMPTE } from "@/lib/niveau-compte-riot";
import { COULEUR_PALIER } from "@/lib/paliers";
import { typographie } from "@/lib/typographie";
import Apparition from "@/components/design/Apparition";
import { BadgeVerdict } from "@/components/design/Badges";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import Tableau from "@/components/design/Tableau";

// Face-à-face entre deux joueurs (19/11/2026) : leurs matchs 1v1, le bilan
// des seuls matchs lus chez Riot, l'écart de rating. Page outil : dense,
// sans animation superflue. Une décision manuelle ou un forfait reste listé
// avec son badge, jamais compté dans le bilan (CLAUDE.md §3).

interface PageProps {
  params: Promise<{ a: string; b: string }>;
}

interface Joueur {
  id: string;
  pseudo: string;
  slug: string;
  rating: number | null;
  rd: number | null;
  palier: Palier | null;
}

const charger = cache(async (slugA: string, slugB: string) => {
  if (slugA === slugB) return null;
  const supabase = await createClient();
  const { data: profils } = await supabase
    .from("profiles")
    .select("id, pseudo, slug, supprime_le")
    .in("slug", [slugA, slugB]);
  const profilA = profils?.find((p) => p.slug === slugA && !p.supprime_le);
  const profilB = profils?.find((p) => p.slug === slugB && !p.supprime_le);
  if (!profilA || !profilB) return null;

  const [{ data: lignes }, { data: ratings }, { data: tiers }] = await Promise.all([
    supabase.rpc("face_a_face", { p_a: profilA.id, p_b: profilB.id }),
    supabase
      .from("ratings")
      .select("profile_id, rating, rd, est_classe, season:seasons!inner(est_courante)")
      .in("profile_id", [profilA.id, profilB.id])
      .eq("game_id", 1)
      .eq("season.est_courante", true),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);
  const paliers: Palier[] = (tiers ?? []).map((t) => ({ nom: t.nom, ratingMin: t.rating_min }));
  // Pas de rating affiché avant l'entrée au classement (règle des données publiques).
  const joueur = (p: { id: string; pseudo: string; slug: string }): Joueur => {
    const r = (ratings ?? []).find((x) => x.profile_id === p.id && x.est_classe);
    const rating = r ? Number(r.rating) : null;
    return {
      id: p.id,
      pseudo: p.pseudo,
      slug: p.slug,
      rating,
      rd: r ? Number(r.rd) : null,
      palier: rating !== null ? trouverPalier(rating, paliers) : null,
    };
  };
  const matchs = (lignes ?? []).map(depuisLigne);
  return { a: joueur(profilA), b: joueur(profilB), matchs };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { a, b } = await params;
  const donnees = await charger(a, b);
  if (!donnees) return { title: "Face-à-face introuvable — Najarena", robots: { index: false } };
  const bilan = bilanFaceAFace(donnees.matchs, donnees.a.id, donnees.b.id);
  return {
    title: `${donnees.a.pseudo} contre ${donnees.b.pseudo} — face-à-face | Najarena`,
    description:
      bilan.verifies > 0
        ? `${donnees.a.pseudo} ${bilan.victoiresA} – ${bilan.victoiresB} ${donnees.b.pseudo} sur ${bilan.verifies} match${bilan.verifies > 1 ? "s" : ""} 1v1 lu${bilan.verifies > 1 ? "s" : ""} dans la donnée officielle Riot.`
        : `Les matchs 1v1 entre ${donnees.a.pseudo} et ${donnees.b.pseudo} sur Najarena.`,
    alternates: { canonical: adresseCanonique(donnees.a.slug, donnees.b.slug) },
    // Une page par paire de joueurs : indexée seulement s'il y a un vrai bilan.
    robots: bilan.verifies > 0 ? undefined : { index: false, follow: true },
  };
}

function CarteJoueur({ j, victoires }: { j: Joueur; victoires: number }) {
  return (
    <Panneau className="flex min-w-0 flex-col gap-3 p-6">
      <Link
        href={`/joueur/${j.slug}`}
        className="font-titre text-2xl font-black uppercase [overflow-wrap:anywhere] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {j.pseudo}
      </Link>
      <p className="font-titre text-6xl leading-none font-black tabular-nums">{victoires}</p>
      <p className="text-xs text-muted uppercase">victoire{victoires > 1 ? "s" : ""} lue{victoires > 1 ? "s" : ""} chez Riot</p>
      <p className="text-sm text-text-2 tabular-nums">
        {j.rating !== null ? (
          <>
            Rating {arrondir(j.rating)}
            {j.palier && (
              <>
                {" · "}
                <span style={{ color: COULEUR_PALIER[j.palier.nom.toLowerCase()] ?? "var(--color-muted)" }}>
                  {j.palier.nom}
                </span>
              </>
            )}
          </>
        ) : (
          "Pas encore classé"
        )}
      </p>
    </Panneau>
  );
}

export default async function FaceAFacePage({ params }: PageProps) {
  const { a, b } = await params;
  const donnees = await charger(a, b);
  if (!donnees) notFound();
  const { a: ja, b: jb, matchs } = donnees;
  const bilan = bilanFaceAFace(matchs, ja.id, jb.id);
  const pseudo = (id: string | null) => (id === ja.id ? ja.pseudo : id === jb.id ? jb.pseudo : "—");
  // Estimation d'après le rating, seulement entre deux joueurs classés.
  const chanceA =
    ja.rating !== null && jb.rating !== null && ja.rd !== null && jb.rd !== null
      ? Math.round(probabiliteVictoire({ rating: ja.rating, rd: ja.rd }, { rating: jb.rating, rd: jb.rd }) * 100)
      : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-4xl">
        <Apparition>
          <Link
            href={`/joueur/${ja.slug}`}
            className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            CV de {ja.pseudo}
          </Link>
          <LibelleSection className="mt-6">Face-à-face</LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase [overflow-wrap:anywhere]">
            {ja.pseudo} contre {jb.pseudo}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            {typographie(
              "Matchs 1v1 entre les deux joueurs, tous formats confondus (tournois, défis, arène, divisions). Le bilan ne compte que les résultats lus dans la donnée officielle Riot.",
            )}
          </p>
        </Apparition>

        <Apparition delai={0.04} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CarteJoueur j={ja} victoires={bilan.victoiresA} />
            <CarteJoueur j={jb} victoires={bilan.victoiresB} />
          </div>
          <ul className="flex flex-col gap-1.5 text-sm text-text-2">
            {bilan.dernier && (
              <li className="tabular-nums">
                {typographie(
                  `Dernier match lu chez Riot : victoire de ${pseudo(bilan.dernier.gagnantId)}, le ${formaterDate(bilan.dernier.joueLe)}.`,
                )}
              </li>
            )}
            {bilan.serie && bilan.serie.longueur >= 2 && (
              <li>{typographie(`${pseudo(bilan.serie.gagnantId)} reste sur ${bilan.serie.longueur} victoires d'affilée.`)}</li>
            )}
            {chanceA !== null && (
              <li className="tabular-nums">
                {typographie(
                  `Chance estimée que ${ja.pseudo} gagne le prochain match : ${chanceA} % (d'après les deux ratings ; une estimation, pas un résultat).`,
                )}
              </li>
            )}
            {(bilan.manuels > 0 || bilan.forfaits > 0 || bilan.horsClassement > 0) && (
              <li className="text-muted">
                {typographie(
                  `Hors bilan : ${listeFrancaise(
                    [
                      bilan.manuels > 0 ? `${bilan.manuels} décision${bilan.manuels > 1 ? "s" : ""} de l'organisateur` : null,
                      bilan.forfaits > 0 ? `${bilan.forfaits} forfait${bilan.forfaits > 1 ? "s" : ""}` : null,
                      bilan.horsClassement > 0 ? matchsSansPoints(bilan.horsClassement) : null,
                    ].filter((x): x is string => x !== null),
                  )}, listés ci-dessous.`,
                )}
                {bilan.horsClassement > 0 && <> {typographie(REGLE_NIVEAU_COMPTE)}</>}
              </li>
            )}
          </ul>
        </Apparition>

        <Apparition delai={0.08}>
          <section aria-labelledby="titre-matchs" className="flex flex-col gap-4">
            <LibelleSection as="h2" id="titre-matchs" className="border-b border-line-strong pb-4">
              Leurs matchs · {matchs.length}
            </LibelleSection>
            {matchs.length === 0 ? (
              <Panneau className="flex flex-col items-start gap-3 p-6">
                <p className="text-text-2">
                  {typographie(`${ja.pseudo} et ${jb.pseudo} ne se sont pas encore affrontés en 1v1.`)}
                </p>
                <Link
                  href={`/joueur/${jb.slug}`}
                  className="text-sm text-text underline underline-offset-3 hover:text-accent"
                >
                  {typographie(`Voir le CV de ${jb.pseudo} pour le défier`)}
                </Link>
              </Panneau>
            ) : (
              <Tableau legende={`Matchs 1v1 entre ${ja.pseudo} et ${jb.pseudo}`}>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Tournoi</th>
                    <th scope="col">Vainqueur</th>
                    <th scope="col">Source</th>
                    <th scope="col" className="text-right!">
                      Preuve
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matchs.map((m) => (
                    <tr key={m.matchId} className={compteAuBilan(m) ? undefined : "text-muted"}>
                      <td className="tabular-nums whitespace-nowrap">{formaterDate(m.joueLe)}</td>
                      <td className="[overflow-wrap:anywhere]">
                        <Link href={`/lol/tournois/${m.tournoiSlug}`} className="hover:text-accent">
                          {m.tournoiNom}
                        </Link>
                      </td>
                      <td>
                        {pseudo(m.gagnantId)}
                        {m.forfait && <span className="text-muted"> (forfait)</span>}
                      </td>
                      <td>
                        <span className="inline-flex flex-col items-start gap-1">
                          <BadgeVerdict niveau={m.niveau} compact />
                          {horsClassementNiveau(m) && (
                            <span className="text-xs text-text-2">{typographie(MENTION_SANS_POINTS)}</span>
                          )}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/lol/match/${m.matchId}`}
                          className="inline-flex min-h-11 items-center text-sm underline underline-offset-3 hover:text-accent"
                        >
                          Fiche<span className="sr-only"> de preuve du match du {formaterDate(m.joueLe)}</span>
                        </Link>
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
