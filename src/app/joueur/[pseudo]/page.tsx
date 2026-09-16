import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SceauFiabilite from "@/components/SceauFiabilite";
import { calibrationPct, arrondir, RD_INITIAL } from "@/lib/classement";
import { LABEL_NIVEAU, COULEUR_NIVEAU, formaterDate } from "@/lib/tournois";
import { chargerOffre, LABEL_OFFRE, COULEUR_OFFRE, ORDRE_OFFRE } from "@/lib/offres";
import { mettreAJourBioProfile } from "@/lib/offres-actions";
import { suivreJoueur } from "@/lib/watchlist-actions";
import { demarrerConversation } from "@/lib/messagerie-actions";
import { JsonLd } from "@/lib/json-ld";
import { classeCarte } from "@/lib/ui";
import Badge from "@/components/ui/Badge";
import Bouton from "@/components/ui/Bouton";
import SectionTitre from "@/components/ui/SectionTitre";
import EtatVide from "@/components/ui/EtatVide";
import IllustrationBracketVide from "@/components/ui/IllustrationBracketVide";
import IllustrationEffectifVide from "@/components/ui/IllustrationEffectifVide";
import FondArene from "@/components/accueil/FondArene";
import BracketBackground from "@/components/BracketBackground";
import Reveal from "@/components/accueil/Reveal";
import CompteurAnime from "@/components/accueil/CompteurAnime";

// Même repli que layout.tsx/robots.ts/sitemap.ts — jamais un domaine inventé.
const URL_SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

  // Étage 1 : ne dépendent que de profil.id, indépendantes entre elles —
  // lancées en parallèle plutôt qu'en série (correctif du 13/09/2026).
  const [
    { data: compteRiot },
    { data: rating },
    { data: participationsData },
    { data: visiteurData },
    infoOffre,
  ] = await Promise.all([
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
      .select(
        "match_id, score, est_gagnant, match:matches(tour, tournament:tournaments(nom, slug))",
      )
      .eq("profile_id", profil.id),
    supabase.auth.getUser(),
    chargerOffre(supabase, profil.id),
  ]);

  const estProprietaire = visiteurData.user?.id === profil.id;

  // Enregistrer la vue — jamais pour un visiteur anonyme, jamais pour le
  // propriétaire qui regarde son propre profil (ce n'est pas une "vue").
  if (visiteurData.user && !estProprietaire) {
    await supabase.from("vues_profil").upsert({
      profile_id: profil.id,
      vu_par: visiteurData.user.id,
      derniere_vue_le: new Date().toISOString(),
    });
  }

  // Un visiteur organisateur peut suivre/contacter ce joueur — chargé
  // seulement pour un visiteur connecté qui n'est pas le propriétaire.
  let offreVisiteur: "gratuit" | "verifie" | "elite" | "organisateur" = "gratuit";
  let dejaSuivi = false;
  if (visiteurData.user && !estProprietaire) {
    const [{ offre: offreV }, { data: suivi }] = await Promise.all([
      chargerOffre(supabase, visiteurData.user.id),
      supabase
        .from("watchlist")
        .select("joueur_suivi_id")
        .eq("recruteur_id", visiteurData.user.id)
        .eq("joueur_suivi_id", profil.id)
        .maybeSingle(),
    ]);
    offreVisiteur = offreV;
    dejaSuivi = Boolean(suivi);
  }

  // "Qui a vu mon profil" — réservé au propriétaire, offre Vérifié+.
  const visiteurs: Array<{ pseudo: string; slug: string; derniereVueLe: string }> = [];
  if (estProprietaire && ORDRE_OFFRE[infoOffre.offre] >= ORDRE_OFFRE.verifie) {
    const { data } = await supabase
      .from("vues_profil")
      .select("derniere_vue_le, visiteur:profiles!vues_profil_vu_par_fkey(pseudo, slug)")
      .eq("profile_id", profil.id)
      .order("derniere_vue_le", { ascending: false })
      .limit(20);

    for (const v of data ?? []) {
      if (!v.visiteur) continue;
      visiteurs.push({ pseudo: v.visiteur.pseudo, slug: v.visiteur.slug, derniereVueLe: v.derniere_vue_le });
    }
  }

  const participations = participationsData ?? [];
  const matchIds = participations.map((p) => p.match_id);

  // Étage 2 : dépendent de matchIds (issu de l'étage 1), indépendantes
  // l'une de l'autre.
  const [{ data: verdictsData }, { data: autresParticipantsData }] = await Promise.all([
    matchIds.length > 0
      ? supabase
          .from("match_verdicts")
          .select("match_id, niveau, motif, cree_le")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : Promise.resolve({ data: [] }),
    matchIds.length > 0
      ? supabase
          .from("match_participants")
          .select("match_id, profile:profiles(pseudo, slug)")
          .in("match_id", matchIds)
          .neq("profile_id", profil.id)
      : Promise.resolve({ data: [] }),
  ]);

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
    infoOffre,
    estProprietaire,
    visiteurs,
    offreVisiteur,
    dejaSuivi,
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
      <main className="mx-auto max-w-3xl px-6 pt-28 pb-16">
        <p className={classeCarte("sceau") + " text-sm text-sceau-texte"}>
          Impossible de charger ce profil pour l&apos;instant. Réessaie dans
          un instant.
        </p>
      </main>
    );
  }

  const { profil, compteRiot, rating, historique, infoOffre, estProprietaire, visiteurs, offreVisiteur, dejaSuivi } = donnees;
  const peutPersonnaliser = ORDRE_OFFRE[infoOffre.offre] >= ORDRE_OFFRE.verifie;
  const visiteurEstOrganisateur = offreVisiteur === "organisateur";
  const pct = rating ? calibrationPct(rating.rd) : 0;
  const matchsCalibres = historique.length;
  const victoires = historique.filter((h) => h.estGagnant).length;
  const tauxVictoire = matchsCalibres > 0 ? Math.round((victoires / matchsCalibres) * 100) : null;

  // Face-à-face : uniquement les adversaires affrontés au moins deux fois —
  // une seule rencontre n'est pas une rivalité, juste un match.
  const rivalites = Array.from(
    historique.reduce((carte, h) => {
      if (!h.adversaire) return carte;
      const existant = carte.get(h.adversaire.slug);
      if (existant) {
        existant.victoires += h.estGagnant ? 1 : 0;
        existant.defaites += h.estGagnant ? 0 : 1;
      } else {
        carte.set(h.adversaire.slug, {
          pseudo: h.adversaire.pseudo,
          slug: h.adversaire.slug,
          victoires: h.estGagnant ? 1 : 0,
          defaites: h.estGagnant ? 0 : 1,
        });
      }
      return carte;
    }, new Map<string, { pseudo: string; slug: string; victoires: number; defaites: number }>())
      .values(),
  )
    .filter((r) => r.victoires + r.defaites >= 2)
    .sort((a, b) => b.victoires + b.defaites - (a.victoires + a.defaites));

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      {/* schema.org ProfilePage — type explicitement pris en charge par les
          rich results Google pour une page de profil public (vérifié dans
          leur doc avant de l'ajouter, contrairement au SportsEvent envisagé
          pour les tournois : Google exclut explicitement les événements
          purement virtuels sans lieu physique, donc pas ajouté là-bas). */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          dateCreated: profil.created_at,
          mainEntity: {
            "@type": "Person",
            name: profil.pseudo,
            identifier: profil.slug,
            url: `${URL_SITE}/joueur/${profil.slug}`,
          },
        }}
      />

      <FondArene />
      <BracketBackground />
      <div className="relative mx-auto max-w-3xl px-6">
      <Reveal>
      <div className={"flex flex-wrap items-start justify-between gap-6 " + classeCarte("laiton")}>
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-encre">
            {profil.pseudo}
          </h1>
          {compteRiot ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.8rem] text-ardoise">
              <span>
                {compteRiot.riot_game_name}#{compteRiot.riot_tag_line} · League of
                Legends · {compteRiot.region}
              </span>
              {compteRiot.verifie_le && <Badge couleur="text-atteste">Vérifié</Badge>}
            </div>
          ) : (
            <div className="mt-1 font-mono text-[0.8rem] text-ardoise">
              Aucun Riot ID lié pour l&apos;instant.
            </div>
          )}
          {profil.pays && (
            <div className="mt-1 text-sm text-ardoise">{profil.pays}</div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge couleur={rating?.est_classe ? "text-atteste" : "text-ardoise"}>
              {rating?.est_classe ? "Classé" : "Non classé"}
            </Badge>
            {infoOffre.offre !== "gratuit" && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-trait bg-carte px-2.5 py-1 font-mono text-[0.64rem] tracking-[0.06em] uppercase"
                style={{ color: COULEUR_OFFRE[infoOffre.offre] }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: COULEUR_OFFRE[infoOffre.offre] }} />
                {LABEL_OFFRE[infoOffre.offre]}
              </span>
            )}
          </div>
          {infoOffre.bio && (
            <p className="mt-2 max-w-md text-sm text-encre">{infoOffre.bio}</p>
          )}
          {infoOffre.lien_externe && (
            <a
              href={infoOffre.lien_externe}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-encre underline underline-offset-3"
            >
              {infoOffre.lien_externe}
            </a>
          )}
          {visiteurEstOrganisateur && (
            <div className="mt-3 flex flex-wrap gap-2">
              {dejaSuivi ? (
                <span className="font-mono text-[0.66rem] text-atteste uppercase">Suivi</span>
              ) : (
                <form action={suivreJoueur}>
                  <input type="hidden" name="joueur_suivi_id" value={profil.id} />
                  <input type="hidden" name="retour" value={`/joueur/${profil.slug}`} />
                  <button
                    type="submit"
                    className="rounded-[3px] border border-trait px-3 py-1.5 font-mono text-[0.64rem] text-encre transition hover:border-encre"
                  >
                    Suivre
                  </button>
                </form>
              )}
              <details className="inline-block">
                <summary className="cursor-pointer rounded-[3px] border border-trait px-3 py-1.5 font-mono text-[0.64rem] text-encre transition hover:border-encre">
                  Contacter
                </summary>
                <form action={demarrerConversation} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="destinataire_id" value={profil.id} />
                  <input type="hidden" name="retour" value={`/joueur/${profil.slug}`} />
                  <textarea
                    name="message"
                    rows={2}
                    maxLength={2000}
                    required
                    placeholder="Ton message…"
                    className="w-full max-w-sm resize-none rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
                  />
                  <Bouton libelleEnCours="Envoi…" className="self-start">
                    Envoyer
                  </Bouton>
                </form>
              </details>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <SceauFiabilite calibrationPct={pct} />
          <span className="font-mono text-[0.6rem] tracking-[0.14em] text-ardoise uppercase">
            {rating ? `RD ${arrondir(rating.rd)}` : `RD ${RD_INITIAL}`}
          </span>
          <p className="mt-1 max-w-[11rem] text-[0.72rem] text-ardoise">
            Le sceau se referme à mesure que le calibrage devient fiable — classé à partir de RD ≤ 150.
          </p>
        </div>
      </div>
      </Reveal>

      <Reveal delai={0.1}>
      <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-[3px] border border-trait bg-carte shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
        <div className="border-r border-trait p-4">
          <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
            Rating
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-laiton">
            {rating ? <CompteurAnime valeur={arrondir(rating.rating)} /> : <span className="text-encre">—</span>}
          </div>
        </div>
        <div className="border-r border-trait p-4">
          <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
            Matchs
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-encre">
            <CompteurAnime valeur={matchsCalibres} />
          </div>
        </div>
        <div className="p-4">
          <div className="font-mono text-[0.6rem] tracking-[0.16em] text-ardoise uppercase">
            Victoires
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-atteste">
            {tauxVictoire !== null ? <CompteurAnime valeur={tauxVictoire} suffixe="%" /> : <span className="text-encre">—</span>}
          </div>
        </div>
      </div>
      </Reveal>

      {estProprietaire && peutPersonnaliser && (
        <>
        <Reveal delai={0.12}>
        <section className="mt-10">
          <SectionTitre>Personnaliser mon profil</SectionTitre>
          <form action={mettreAJourBioProfile} className="mt-3 flex flex-col gap-2">
            <label>
              <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
                Bio (140 caractères max)
              </span>
              <textarea
                name="bio"
                rows={2}
                maxLength={140}
                defaultValue={infoOffre.bio ?? ""}
                placeholder="Ex. « Mid laner, dispo le soir, cherche une équipe compétitive »"
                className="mt-1 w-full resize-none rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
              />
            </label>
            <label>
              <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
                Lien externe (réseaux, sponsor…)
              </span>
              <input
                name="lien_externe"
                type="url"
                defaultValue={infoOffre.lien_externe ?? ""}
                placeholder="https://…"
                className="mt-1 w-full rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
              />
            </label>
            <Bouton libelleEnCours="Enregistrement…" className="self-start">
              Enregistrer
            </Bouton>
          </form>
        </section>
        </Reveal>

        <Reveal delai={0.14}>
        <section className="mt-10">
          <SectionTitre>Qui a vu ton profil</SectionTitre>
          {visiteurs.length === 0 ? (
            <div className="mt-3">
              <EtatVide illustration={<IllustrationEffectifVide />}>
                Personne n&apos;a encore consulté ton profil.
              </EtatVide>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {visiteurs.map((v) => (
                <li key={v.slug} className={"flex items-center justify-between " + classeCarte("none")}>
                  <Link href={`/joueur/${v.slug}`} className="text-sm font-medium text-encre hover:underline">
                    {v.pseudo}
                  </Link>
                  <span className="font-mono text-[0.7rem] text-ardoise">{formaterDate(v.derniereVueLe)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </Reveal>
        </>
      )}

      {rivalites.length > 0 && (
        <Reveal delai={0.15}>
        <section className="mt-10">
          <SectionTitre>Face-à-face</SectionTitre>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rivalites.map((r) => (
              <li key={r.slug} className={"flex items-center justify-between gap-3 " + classeCarte("none")}>
                <Link
                  href={`/joueur/${r.slug}`}
                  className="font-medium text-encre hover:underline"
                >
                  {r.pseudo}
                </Link>
                <span className="font-mono text-sm font-bold text-ardoise">
                  <span className="text-atteste">{r.victoires}V</span>
                  {" — "}
                  <span className="text-sceau-texte">{r.defaites}D</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        </Reveal>
      )}

      <Reveal delai={0.2}>
      <section className="mt-10">
        <SectionTitre>Registre des matchs</SectionTitre>
        {historique.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.78rem] text-ardoise">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-atteste" />
              Niveau 2/3 — compte pour le classement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ardoise" />
              Niveau 1 — décision manuelle, hors classement
            </span>
          </div>
        )}

        {historique.length === 0 ? (
          <div className="mt-3">
            <EtatVide illustration={<IllustrationBracketVide />}>
              Aucun résultat enregistré pour l&apos;instant.
            </EtatVide>
          </div>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-[3px] border border-trait bg-carte shadow-[0_1px_2px_rgba(18,22,29,0.05),0_10px_24px_-16px_rgba(18,22,29,0.15)]">
            {historique.map((h) => (
              <li
                key={h.matchId}
                className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-trait px-4 py-3 text-sm last:border-b-0 ${
                  h.estGagnant ? "bg-atteste/5" : ""
                }`}
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
                <Badge couleur={COULEUR_NIVEAU[h.niveau]}>{LABEL_NIVEAU[h.niveau]}</Badge>
                <span
                  className={`font-mono text-sm font-bold ${
                    h.estGagnant ? "text-atteste" : "text-sceau-texte"
                  }`}
                >
                  {h.estGagnant ? "V" : "D"}
                </span>
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
