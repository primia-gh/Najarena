import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { calibrationPct, arrondir, RD_INITIAL } from "@/lib/classement";
import { LABEL_NIVEAU, COULEUR_NIVEAU, formaterDate } from "@/lib/tournois";
import { chargerOffre, LABEL_OFFRE, COULEUR_OFFRE } from "@/lib/offres";
import Badge from "@/components/ui/Badge";
import BoutonImprimer from "@/components/ui/BoutonImprimer";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface CvPageProps {
  params: Promise<{ pseudo: string }>;
}

// Page publique dédiée (comme /joueur/[pseudo] lui-même) : un recruteur ou
// un sponsor qui reçoit ce lien n'a pas besoin de compte Najarena. Ce qui
// est réservé à l'offre Elite, c'est le BOUTON d'accès depuis le profil
// (voir joueur/[pseudo]/page.tsx), pas la page une fois le lien partagé —
// exactement l'esprit "lien à envoyer directement à une équipe ou un
// sponsor" de la fonctionnalité.
async function chargerCV(slug: string) {
  const supabase = await createClient();

  const { data: profil } = await supabase
    .from("profiles")
    .select("id, pseudo, slug, pays, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!profil) return null;

  const [{ data: compteRiot }, { data: rating }, { data: participationsData }, infoOffre] =
    await Promise.all([
      supabase
        .from("game_accounts")
        .select("riot_game_name, riot_tag_line, region, verifie_le")
        .eq("profile_id", profil.id)
        .eq("est_principal", true)
        .maybeSingle(),
      supabase
        .from("ratings")
        .select("rating, rd, matchs_joues, est_classe")
        .eq("profile_id", profil.id)
        .eq("game_id", 1)
        .order("maj_le", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("match_participants")
        .select("match_id, est_gagnant, match:matches(tournament:tournaments(nom))")
        .eq("profile_id", profil.id),
      chargerOffre(supabase, profil.id),
    ]);

  const participations = participationsData ?? [];
  const matchIds = participations.map((p) => p.match_id);

  const { data: verdictsData } =
    matchIds.length > 0
      ? await supabase
          .from("match_verdicts")
          .select("match_id, niveau, cree_le")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : { data: [] };

  const verdictParMatch = new Map((verdictsData ?? []).map((v) => [v.match_id, v]));

  const historique = participations
    .map((p) => {
      const verdict = verdictParMatch.get(p.match_id);
      if (!verdict) return null;
      return {
        matchId: p.match_id,
        estGagnant: p.est_gagnant,
        tournoi: p.match?.tournament?.nom ?? null,
        niveau: verdict.niveau,
        creeLe: verdict.cree_le,
      };
    })
    .filter((h): h is NonNullable<typeof h> => h !== null)
    .sort((a, b) => new Date(b.creeLe).getTime() - new Date(a.creeLe).getTime())
    .slice(0, 10);

  const matchsCalibres = historique.length;
  const victoires = historique.filter((h) => h.estGagnant).length;
  const tauxVictoire = matchsCalibres > 0 ? Math.round((victoires / matchsCalibres) * 100) : null;

  return { profil, compteRiot, rating, infoOffre, historique, matchsCalibres, victoires, tauxVictoire };
}

export default async function CvPage({ params }: CvPageProps) {
  const { pseudo } = await params;
  const donnees = await chargerCV(pseudo);

  if (!donnees) {
    notFound();
  }

  const { profil, compteRiot, rating, infoOffre, historique, matchsCalibres, victoires, tauxVictoire } =
    donnees;
  const pct = rating ? calibrationPct(rating.rd) : 0;

  return (
    <main className="min-h-screen bg-papier px-6 py-16 print:bg-white print:py-6 print:text-black">
      <div className="mx-auto max-w-2xl">
        <div className="print:hidden mb-8 flex items-center justify-between">
          <Link href={`/joueur/${profil.slug}`} className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre">
            ← Retour au profil
          </Link>
          <BoutonImprimer />
        </div>

        <header className="border-b-2 border-encre pb-4 print:border-black">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-encre print:text-black">
            {profil.pseudo}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.8rem] text-ardoise print:text-black">
            {compteRiot && (
              <span>
                {compteRiot.riot_game_name}#{compteRiot.riot_tag_line} · League of Legends · {compteRiot.region}
                {compteRiot.verifie_le && " · Vérifié"}
              </span>
            )}
            {profil.pays && <span>· {profil.pays}</span>}
          </div>
          {infoOffre.offre !== "gratuit" && (
            <span
              className="mt-2 inline-block font-mono text-[0.64rem] tracking-[0.06em] uppercase print:text-black"
              style={{ color: COULEUR_OFFRE[infoOffre.offre] }}
            >
              {LABEL_OFFRE[infoOffre.offre]}
            </span>
          )}
          {infoOffre.bio && <p className="mt-2 text-sm text-encre print:text-black">{infoOffre.bio}</p>}
        </header>

        <section className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-[3px] border border-trait bg-trait print:border-black print:bg-black">
          <div className="bg-carte p-3 text-center print:bg-white">
            <div className="font-mono text-[0.58rem] tracking-[0.1em] text-ardoise uppercase print:text-black">Rating</div>
            <div className="mt-0.5 font-mono text-xl font-bold text-encre print:text-black">
              {rating ? arrondir(rating.rating) : "—"}
            </div>
          </div>
          <div className="bg-carte p-3 text-center print:bg-white">
            <div className="font-mono text-[0.58rem] tracking-[0.1em] text-ardoise uppercase print:text-black">RD</div>
            <div className="mt-0.5 font-mono text-xl font-bold text-encre print:text-black">
              {rating ? arrondir(rating.rd) : RD_INITIAL}
            </div>
          </div>
          <div className="bg-carte p-3 text-center print:bg-white">
            <div className="font-mono text-[0.58rem] tracking-[0.1em] text-ardoise uppercase print:text-black">Calibrage</div>
            <div className="mt-0.5 font-mono text-xl font-bold text-encre print:text-black">{pct}%</div>
          </div>
          <div className="bg-carte p-3 text-center print:bg-white">
            <div className="font-mono text-[0.58rem] tracking-[0.1em] text-ardoise uppercase print:text-black">Victoires</div>
            <div className="mt-0.5 font-mono text-xl font-bold text-encre print:text-black">
              {tauxVictoire !== null ? `${tauxVictoire}%` : "—"}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-extrabold text-encre print:text-black">
            Registre des matchs récents
          </h2>
          {historique.length === 0 ? (
            <p className="mt-2 text-sm text-ardoise print:text-black">Aucun résultat enregistré pour l&apos;instant.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {historique.map((h) => (
                <li
                  key={h.matchId}
                  className="flex items-center justify-between gap-3 border-b border-trait py-1.5 text-sm print:border-black"
                >
                  <span className="font-mono text-[0.7rem] text-ardoise print:text-black">
                    {formaterDate(h.creeLe)}
                  </span>
                  <span className="flex-1 text-encre print:text-black">{h.tournoi ?? "—"}</span>
                  <span className="print:hidden">
                    <Badge couleur={COULEUR_NIVEAU[h.niveau]}>{LABEL_NIVEAU[h.niveau]}</Badge>
                  </span>
                  <span className={`font-mono text-sm font-bold ${h.estGagnant ? "text-atteste" : "text-sceau-texte"} print:text-black`}>
                    {h.estGagnant ? "V" : "D"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-10 font-mono text-[0.62rem] text-ardoise print:text-black">
          {matchsCalibres} matchs vérifiés · {victoires} victoires — profil complet : najarena.vercel.app/joueur/{profil.slug}
        </footer>
      </div>
    </main>
  );
}
