import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CONDITIONS_VICTOIRE } from "@/lib/conditions-1v1";
import { calibrationPct } from "@/lib/classement";
import { ecartArene, EXPIRATION_ARENE_MINUTES, minutesEnFile } from "@/lib/arene";
import { entrerDansArene, quitterArene } from "@/lib/arene-actions";
import { CARTE_1V1, REGLE_FORFAIT } from "@/lib/reglement";
import { SuiviTempsReel } from "@/components/SuiviTempsReel";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import IndicateurConfiance from "@/components/design/IndicateurConfiance";

// Arène 1v1 à la demande (03/10/2026, audit N19) : un duel tout de suite
// contre un joueur de sa région au rating proche. Appariement par la base
// (rejoindre_arene à l'entrée, apparier_arene toutes les 5 minutes).

export const metadata: Metadata = {
  title: "Arène 1v1 — Najarena",
  description:
    "Un duel League of Legends tout de suite contre un joueur de ton niveau : une partie, résultat lu chez Riot, classé.",
  alternates: { canonical: "/lol/arene" },
};

const CHAMP =
  "min-h-11 w-full rounded-bouton border border-line-strong bg-bg px-3 py-2.5 font-texte text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Hors du composant (règle de pureté du rendu).
function minutesDepuis(entreeLe: string): number {
  return minutesEnFile(entreeLe, new Date());
}

interface ArenePageProps {
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

export default async function ArenePage({ searchParams }: ArenePageProps) {
  const { erreur, message } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const moi = userData.user?.id ?? null;

  const [compte, etat, place, rating, duels] = moi
    ? await Promise.all([
        supabase
          .from("game_accounts")
          .select("region, verifie_le")
          .eq("profile_id", moi)
          .eq("game_id", 1)
          .eq("est_principal", true)
          .maybeSingle()
          .then((r) => r.data),
        supabase.rpc("etat_arene").then((r) => r.data?.[0] ?? null),
        supabase
          .from("file_arene")
          .select("rd, condition_victoire")
          .eq("profile_id", moi)
          .maybeSingle()
          .then((r) => r.data),
        supabase
          .from("ratings")
          .select("rating, rd, est_classe, season:seasons!inner(est_courante)")
          .eq("profile_id", moi)
          .eq("game_id", 1)
          .eq("season.est_courante", true)
          .maybeSingle()
          .then((r) => r.data),
        supabase
          .from("registrations")
          .select("tournament:tournaments!inner(slug, nom, nature, statut)")
          .eq("profile_id", moi)
          .eq("tournament.nature", "defi")
          .eq("tournament.statut", "en_cours")
          .then((r) => r.data ?? []),
      ])
    : [null, null, null, null, []];

  const compteVerifie = Boolean(compte?.verifie_le);
  const duel = duels[0]?.tournament ?? null;
  const enFile = Boolean(etat?.en_file && etat.entree_le);
  const attente = enFile && etat?.entree_le ? minutesDepuis(etat.entree_le) : 0;
  const rdMoi = place?.rd ?? rating?.rd ?? 350;
  const condition = CONDITIONS_VICTOIRE.find((c) => c.valeur === (place?.condition_victoire ?? "nexus"));

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      {enFile && <SuiviTempsReel canal={`arene-${moi}`} tables={["registrations"]} />}
      <div className="relative px-grille *:max-w-3xl">
        <Apparition>
          <Link
            href="/lol"
            className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            ← League of Legends
          </Link>
          <h1 className="mt-6 font-titre text-section font-black tracking-[1px] uppercase">
            Arène <span className="text-accent">1v1</span>
          </h1>
          <p className="mt-3 max-w-xl text-courant text-text-2">
            Un duel tout de suite, sans attendre le prochain tournoi : entre dans la file, le site te trouve un joueur
            de ta région au rating proche. Une partie, résultat lu chez Riot, comptée au classement.
          </p>
        </Apparition>

        {erreur && (
          <p
            role="alert"
            className="mt-6 rounded-bouton border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {erreur}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-6 rounded-bouton border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          >
            {message}
          </p>
        )}

        <Apparition delai={0.06} className="mt-8 block">
          <Panneau className="flex flex-col gap-4 p-6">
            {!moi ? (
              <>
                <p className="text-sm text-text-2">Connecte-toi pour entrer dans l&apos;arène.</p>
                <BoutonLien href={`/connexion?suite=${encodeURIComponent("/lol/arene")}`} className="self-start">
                  Se connecter
                </BoutonLien>
              </>
            ) : duel ? (
              <>
                <LibelleSection as="h2">Ton duel est ouvert</LibelleSection>
                <p className="text-sm text-text-2">
                  {duel.nom} — déclare-toi prêt dans la salle de match, puis lance la partie.
                </p>
                <BoutonLien href={`/lol/tournois/${duel.slug}#ton-match`} className="self-start">
                  Aller à la salle de match
                </BoutonLien>
              </>
            ) : !compteVerifie ? (
              <>
                <p className="text-sm text-text-2">
                  L&apos;arène demande un compte Riot vérifié : c&apos;est lui qui permet de retrouver ta partie et
                  d&apos;en lire le résultat.
                </p>
                <BoutonLien href="/lier-riot" className="self-start">
                  Lier mon compte Riot
                </BoutonLien>
              </>
            ) : enFile ? (
              <>
                <LibelleSection as="h2">Recherche d&apos;un adversaire…</LibelleSection>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-mini text-muted uppercase">En file depuis</dt>
                    <dd className="font-titre text-2xl font-extrabold tabular-nums">{attente} min</dd>
                  </div>
                  <div>
                    <dt className="text-mini text-muted uppercase">En attente ({compte?.region})</dt>
                    <dd className="font-titre text-2xl font-extrabold tabular-nums">{etat?.en_attente_region ?? 1}</dd>
                  </div>
                  <div>
                    <dt className="text-mini text-muted uppercase">Écart toléré</dt>
                    <dd className="font-titre text-2xl font-extrabold tabular-nums">
                      ±{Math.round(ecartArene(rdMoi, 0, attente))}
                    </dd>
                  </div>
                </dl>
                <p className="text-sm text-muted">
                  {condition?.libelle}. L&apos;écart toléré grandit avec l&apos;attente ; ta place expire après{" "}
                  {EXPIRATION_ARENE_MINUTES} minutes sans adversaire. Tu es prévenu (notification et message privé
                  Discord) dès qu&apos;un duel est trouvé — cette page s&apos;actualise d&apos;elle-même.
                </p>
                <form action={quitterArene}>
                  <BoutonEnvoi variante="contour" libelleEnCours="Sortie…">
                    Quitter la file
                  </BoutonEnvoi>
                </form>
              </>
            ) : (
              <form action={entrerDansArene} className="flex flex-col gap-4">
                {rating && (
                  <div className="flex flex-wrap items-center gap-4">
                    <p className="text-sm text-text-2">
                      Ton rating :{" "}
                      <span className="font-semibold tabular-nums text-text">{Math.round(rating.rating)}</span>
                    </p>
                    <IndicateurConfiance estClasse={Boolean(rating.est_classe)} pct={calibrationPct(rating.rd)} />
                  </div>
                )}
                <label className="flex max-w-xs flex-col gap-2">
                  <span className="text-mini text-muted uppercase">Comment on gagne</span>
                  <select name="condition_victoire" defaultValue="nexus" className={CHAMP}>
                    {CONDITIONS_VICTOIRE.map((c) => (
                      <option key={c.valeur} value={c.valeur}>
                        {c.libelle}
                      </option>
                    ))}
                  </select>
                </label>
                <BoutonEnvoi libelleEnCours="Entrée…" className="self-start">
                  Entrer dans l&apos;arène
                </BoutonEnvoi>
              </form>
            )}
          </Panneau>
        </Apparition>

        <Apparition delai={0.1} className="mt-12 block">
          <LibelleSection as="h2">Les règles</LibelleSection>
          <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-text-2">
            <li>
              <strong className="text-text">Un adversaire de ton niveau.</strong> Même région, même règle de victoire,
              rating proche : 100 points d&apos;écart au départ, plus la moitié de l&apos;indice d&apos;incertitude (RD)
              le plus élevé des deux — un niveau encore peu connu affronte plus large — puis 20 points de plus par
              minute d&apos;attente, 500 au plus.
            </li>
            <li>
              <strong className="text-text">Une partie.</strong> Partie personnalisée {CARTE_1V1} en 1v1. Tu choisis
              comment on gagne en entrant —{" "}
              {CONDITIONS_VICTOIRE.map((c) => c.libelle.charAt(0).toLowerCase() + c.libelle.slice(1)).join(", ou ")} —
              et tu n&apos;affrontes qu&apos;un joueur qui a choisi la même règle.
            </li>
            <li>
              <strong className="text-text">Résultat lu chez Riot.</strong> La partie est retrouvée dans
              l&apos;historique officiel ; sans partie retrouvée dans les 24 h, le duel est annulé, jamais tranché au
              hasard. {REGLE_FORFAIT}
            </li>
            <li>
              <strong className="text-text">Classé, sans abus.</strong> Le duel compte au classement comme un défi : un
              seul duel classé par jour entre deux mêmes joueurs, les suivants se jouent en amical.
            </li>
          </ul>
        </Apparition>
      </div>
    </main>
  );
}
