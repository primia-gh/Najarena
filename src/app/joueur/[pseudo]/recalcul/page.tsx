import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { creerClientPublic } from "@/lib/supabase/public";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import RecalculJoueur from "@/components/registre/RecalculJoueur";

// « Recalcule toi-même » (09/10/2026, idée en réserve n°4) : le registre
// prouve qu'aucune ligne n'a été retouchée ; cette page prouve que chaque
// ligne suit la formule annoncée, en refaisant le calcul Glicko-2 dans le
// navigateur du visiteur. Page outil, non indexée.

export const metadata: Metadata = {
  title: "Recalcule toi-même — Najarena",
  robots: { index: false, follow: false },
};

export default async function RecalculPage({ params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  const supabase = creerClientPublic();
  const { data: profil } = await supabase
    .from("profiles")
    .select("id, pseudo, slug, supprime_le")
    .eq("slug", pseudo)
    .maybeSingle();
  if (!profil || profil.supprime_le) notFound();
  // Joueur pas encore entré au classement : ses lignes sont publiques au
  // registre et se recalculent comme les autres, mais son rating reste
  // provisoire (décision du porteur du 17/11/2026 : on le montre, en le
  // disant).
  const { data: saison } = await supabase.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle();
  const { data: rating } = saison
    ? await supabase
        .from("ratings")
        .select("est_classe")
        .eq("profile_id", profil.id)
        .eq("game_id", 1)
        .eq("season_id", saison.id)
        .maybeSingle()
    : { data: null };
  const estClasse = rating?.est_classe === true;

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille">
        <Apparition>
          <span className="block font-texte text-libelle font-medium text-muted uppercase">Preuve</span>
          <h1 className="mt-1 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
            Recalcule toi-même
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-2">
            Ton navigateur refait ici, ligne par ligne, le calcul des points de{" "}
            <Link href={`/joueur/${profil.slug}`} className="text-text underline underline-offset-3 hover:text-accent">
              {profil.pseudo}
            </Link>{" "}
            avec la formule Glicko-2 du site, à partir des seules données publiques : son{" "}
            <Link href="/registre" className="text-text underline underline-offset-3 hover:text-accent">
              registre des points
            </Link>
            , ses matchs et leur verdict, et le niveau de ses adversaires au début de chaque tournoi. Mêmes règles qu&apos;à
            la clôture : seuls les résultats lus chez Riot comptent, jamais un forfait ni une décision manuelle, et au-delà
            de 3 victoires contre le même adversaire en 24 h les suivantes sont ignorées.
          </p>
          {!estClasse && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              {profil.pseudo} n&apos;est pas encore entré au classement cette saison&nbsp;: les points recalculés ici
              sont bien ceux du registre, mais son rating reste provisoire (incertitude encore élevée) jusqu&apos;à une
              dizaine de matchs vérifiés.
            </p>
          )}
        </Apparition>

        <RecalculJoueur slug={profil.slug} />

        <details className="mt-10 max-w-3xl text-sm text-text-2">
          <summary className="cursor-pointer font-semibold text-text">Refaire le calcul avec tes propres outils</summary>
          <p className="mt-2 leading-relaxed">
            Les données utilisées sont publiques, au format JSON :{" "}
            <a
              href={`/api/public/v1/joueurs/${profil.slug}/recalcul`}
              className="text-text underline underline-offset-3 hover:text-accent"
            >
              /api/public/v1/joueurs/{profil.slug}/recalcul
            </a>
            . Constantes : rating initial 1500, RD initial 350, volatilité initiale 0,06, tau 0,5 (détail sur{" "}
            <Link href="/comment-ca-marche" className="text-text underline underline-offset-3 hover:text-accent">
              Comment ça marche
            </Link>
            ). La volatilité n&apos;est pas inscrite au registre : on la reconstitue en rejouant tout l&apos;historique du
            joueur depuis sa première ligne. Le registre arrondit à deux décimales ; un écart d&apos;un centième est donc
            normal.
          </p>
        </details>
      </div>
    </main>
  );
}
