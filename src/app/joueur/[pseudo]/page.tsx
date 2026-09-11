import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SceauFiabilite from "@/components/SceauFiabilite";
import { calibrationPct, arrondir, RD_INITIAL } from "@/lib/classement";
import { LABEL_NIVEAU, COULEUR_NIVEAU, formaterDate } from "@/lib/tournois";

interface JoueurPageProps {
  params: Promise<{ pseudo: string }>;
}

async function chargerJoueur(slug: string) {
  const supabase = await createClient();

  // Le segment d'URL s'appelle "pseudo" (arborescence CLAUDE.md) mais
  // contient en réalité le slug — identique au pseudo normalisé pour
  // l'URL, comme pour les tournois et les équipes.
  const { data: profil, error: erreurProfil } = await supabase
    .from("profiles")
    .select("id, pseudo, slug, pays, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (erreurProfil) {
    return { statut: "erreur" as const };
  }
  if (!profil) {
    return { statut: "introuvable" as const };
  }

  const { data: compteRiot } = await supabase
    .from("game_accounts")
    .select("riot_game_name, riot_tag_line, region, verifie_le")
    .eq("profile_id", profil.id)
    .eq("est_principal", true)
    .maybeSingle();

  const { data: rating } = await supabase
    .from("ratings")
    .select("rating, rd, matchs_joues, est_classe")
    .eq("profile_id", profil.id)
    .eq("game_id", 1)
    .order("maj_le", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: participationsData } = await supabase
    .from("match_participants")
    .select(
      "match_id, score, est_gagnant, match:matches(tour, tournament:tournaments(nom, slug))",
    )
    .eq("profile_id", profil.id);

  const participations = participationsData ?? [];
  const matchIds = participations.map((p) => p.match_id);

  const { data: verdictsData } =
    matchIds.length > 0
      ? await supabase
          .from("match_verdicts")
          .select("match_id, niveau, motif, cree_le")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : { data: [] };

  const { data: autresParticipantsData } =
    matchIds.length > 0
      ? await supabase
          .from("match_participants")
          .select("match_id, profile:profiles(pseudo, slug)")
          .in("match_id", matchIds)
          .neq("profile_id", profil.id)
      : { data: [] };

  const verdictParMatch = new Map((verdictsData ?? []).map((v) => [v.match_id, v]));
  const adversaireParMatch = new Map(
    (autresParticipantsData ?? []).map((a) => [a.match_id, a.profile]),
  );

  const historique = participations
    .map((p) => {
      const verdict = verdictParMatch.get(p.match_id);
      if (!verdict) return null;
      return {
        matchId: p.match_id,
        score: p.score,
        estGagnant: p.est_gagnant,
        tournoi: p.match?.tournament ?? null,
        adversaire: adversaireParMatch.get(p.match_id) ?? null,
        niveau: verdict.niveau,
        motif: verdict.motif,
        creeLe: verdict.cree_le,
      };
    })
    .filter((h): h is NonNullable<typeof h> => h !== null)
    .sort((a, b) => new Date(b.creeLe).getTime() - new Date(a.creeLe).getTime());

  return {
    statut: "ok" as const,
    profil,
    compteRiot,
    rating,
    historique,
  };
}

export async function generateMetadata({ params }: JoueurPageProps): Promise<Metadata> {
  const { pseudo } = await params;
  const donnees = await chargerJoueur(pseudo);

  if (donnees.statut !== "ok") {
    return { title: "Profil introuvable — Najarena" };
  }

  return {
    title: `${donnees.profil.pseudo} — Najarena`,
    description: `Profil vérifié de ${donnees.profil.pseudo} sur Najarena. Résultats League of Legends lus dans la donnée officielle Riot.`,
  };
}

export default async function JoueurPage({ params }: JoueurPageProps) {
  const { pseudo } = await params;
  const donnees = await chargerJoueur(pseudo);

  if (donnees.statut === "introuvable") {
    notFound();
  }

  if (donnees.statut === "erreur") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="rounded-[3px] border border-sceau/30 bg-sceau/10 p-6 text-sm text-sceau">
          Impossible de charger ce profil pour l&apos;instant. Réessaie dans
          un instant.
        </p>
      </main>
    );
  }

  const { profil, compteRiot, rating, historique } = donnees;
  const pct = rating ? calibrationPct(rating.rd) : 0;
  const matchsCalibres = historique.length;
  const victoires = historique.filter((h) => h.estGagnant).length;
  const tauxVictoire = matchsCalibres > 0 ? Math.round((victoires / matchsCalibres) * 100) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        Najarena
      </Link>

      <div className="mt-6 flex items-start justify-between gap-6 rounded-[3px] border border-trait bg-carte p-6">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-encre">
            {profil.pseudo}
          </h1>
          {compteRiot ? (
            <div className="mt-1 font-mono text-[0.8rem] text-ardoise">
              {compteRiot.riot_game_name}#{compteRiot.riot_tag_line} · League of
              Legends · {compteRiot.region}
              {compteRiot.verifie_le && <span className="ml-2 text-atteste">Vérifié</span>}
            </div>
          ) : (
            <div className="mt-1 font-mono text-[0.8rem] text-ardoise">
              Aucun Riot ID lié pour l&apos;instant.
            </div>
          )}
          {profil.pays && (
            <div className="mt-1 text-sm text-ardoise">{profil.pays}</div>
          )}
          <div className="mt-3 font-display text-lg font-extrabold text-laiton-texte">
            {rating?.est_classe ? "Classé" : "Non classé"}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <SceauFiabilite calibrationPct={pct} />
          <span className="font-mono text-[0.6rem] tracking-[0.14em] text-ardoise uppercase">
            {rating ? `RD ${arrondir(rating.rd)}` : `RD ${RD_INITIAL}`}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 border border-trait bg-carte">
        <div className="border-r border-trait p-4">
          <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
            Rating
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
            {rating ? arrondir(rating.rating) : "—"}
          </div>
        </div>
        <div className="border-r border-trait p-4">
          <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
            Matchs
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
            {matchsCalibres}
          </div>
        </div>
        <div className="p-4">
          <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
            Victoires
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
            {tauxVictoire !== null ? `${tauxVictoire}%` : "—"}
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-encre">
          Registre des matchs
        </h2>

        {historique.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-trait bg-carte p-4 text-sm text-ardoise">
            Aucun résultat enregistré pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {historique.map((h) => (
              <li
                key={h.matchId}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-trait px-1 py-3 text-sm last:border-b-0"
              >
                <span className="font-mono text-[0.72rem] text-ardoise">
                  {formaterDate(h.creeLe)}
                </span>
                <span className="font-medium text-encre">
                  {h.adversaire ? (
                    <Link href={`/joueur/${h.adversaire.slug}`} className="hover:underline">
                      {h.adversaire.pseudo}
                    </Link>
                  ) : (
                    "Adversaire inconnu"
                  )}
                  {h.tournoi && (
                    <span className="ml-2 font-mono text-[0.7rem] text-ardoise">
                      · {h.tournoi.nom}
                    </span>
                  )}
                </span>
                <span
                  className={`font-mono text-[0.58rem] tracking-[0.1em] uppercase ${COULEUR_NIVEAU[h.niveau]}`}
                >
                  {LABEL_NIVEAU[h.niveau]}
                </span>
                <span
                  className={`font-mono text-sm font-bold ${
                    h.estGagnant ? "text-atteste" : "text-sceau"
                  }`}
                >
                  {h.estGagnant ? "V" : "D"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
