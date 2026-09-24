import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { calibrationPct, arrondir, RATING_INITIAL, RD_INITIAL } from "@/lib/classement";
import { formaterDate } from "@/lib/tournois";
import { chargerOffre, LABEL_OFFRE, COULEUR_OFFRE, ORDRE_OFFRE } from "@/lib/offres";
import { mettreAJourBioProfile } from "@/lib/offres-actions";
import { suivreJoueur } from "@/lib/watchlist-actions";
import { demarrerConversation } from "@/lib/messagerie-actions";
import { chargerMoyennes, genererRevue, type StatsMatch } from "@/lib/revue-match";
import { JsonLd } from "@/lib/json-ld";
import { chargerComplementsProfil } from "@/lib/profil-vitrine";
import { COULEUR_PALIER } from "@/lib/paliers";
import { classeBoutonContour, classeBoutonPrincipal } from "@/lib/design";
import BoutonLien from "@/components/design/BoutonLien";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import { BadgeChercheEquipe, BadgeVerdict, BadgeVerifie } from "@/components/design/Badges";
import PastilleResultat from "@/components/design/PastilleResultat";
import ChiffreRating from "@/components/design/ChiffreRating";
import IndicateurConfiance from "@/components/design/IndicateurConfiance";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import CourbeProgression from "@/components/profil/CourbeProgression";
import BoutonPartager from "@/components/profil/BoutonPartager";

// Refonte « Venin » du 23/09/2026 (design-system/najarena/pages/profil.md,
// maquette najarena-design/maquettes/profil.dc.html) : seule l'apparence a
// changé. chargerJoueur ci-dessous (vues de profil, offres, suivi, revue de
// match) est repris tel quel ; les données d'affichage ajoutées (rang
// national, palier, courbe, équipes, annonce) viennent de
// lib/profil-vitrine.ts. Blocs de la maquette sans donnée réelle (Talent
// Score, analyse IA, classement par rôle, VOD, réglage public/privé par
// bloc) : absents tant que la fonctionnalité n'existe pas (CLAUDE.md §7).

// Même repli que layout.tsx/robots.ts/sitemap.ts — jamais un domaine inventé.
const URL_SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Motifs de rating_events autres que "tournoi" (voir docs/schema.sql).
const LABEL_MOTIF: Record<string, string> = {
  soft_reset: "Nouvelle saison (remise partielle)",
  inactivite: "Inactivité",
  correction: "Correction",
};

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
    { data: evenementsData },
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
    // Journal des points : public par conception (CLAUDE.md §4, policy
    // select using(true) sur rating_events) — jamais réservé au propriétaire.
    supabase
      .from("rating_events")
      .select("id, motif, rating_avant, rating_apres, cree_le, tournoi:tournaments(nom, slug)")
      .eq("profile_id", profil.id)
      .eq("game_id", 1)
      .order("cree_le", { ascending: false })
      .limit(20),
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

  // Revue de match écrite — réservée au propriétaire, offre Elite+.
  // stats_match_joueur/chargerMoyennes ne sont interrogés que si les deux
  // conditions sont réunies, pour ne pas alourdir la page pour tout le monde.
  const peutRevue = estProprietaire && ORDRE_OFFRE[infoOffre.offre] >= ORDRE_OFFRE.elite;
  let statsParMatch = new Map<string, StatsMatch>();
  let moyennesVictoires: Awaited<ReturnType<typeof chargerMoyennes>>["victoires"] = null;
  if (peutRevue && matchIds.length > 0) {
    const [{ data: statsData }, moyennes] = await Promise.all([
      supabase
        .from("stats_match_joueur")
        .select("match_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne")
        .eq("profile_id", profil.id)
        .in("match_id", matchIds),
      chargerMoyennes(supabase, profil.id),
    ]);
    statsParMatch = new Map(
      (statsData ?? []).map((s) => [
        s.match_id,
        {
          champion: s.champion,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          cs: s.cs,
          orGagne: s.or_gagne,
          dureeSecondes: s.duree_secondes,
          gagne: s.gagne,
        } satisfies StatsMatch,
      ]),
    );
    moyennesVictoires = moyennes.victoires;
  }

  const historique = participations
    .map((p) => {
      const verdict = verdictParMatch.get(p.match_id);
      if (!verdict) return null;
      const stats = statsParMatch.get(p.match_id) ?? null;
      return {
        matchId: p.match_id,
        score: p.score,
        estGagnant: p.est_gagnant,
        tournoi: p.match?.tournament ?? null,
        adversaire: adversaireParMatch.get(p.match_id) ?? null,
        niveau: verdict.niveau,
        motif: verdict.motif,
        creeLe: verdict.cree_le,
        stats,
        revue: stats ? genererRevue(stats, moyennesVictoires) : null,
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
    evenementsPoints: evenementsData ?? [],
    infoOffre,
    estProprietaire,
    visiteurs,
    offreVisiteur,
    dejaSuivi,
    peutRevue,
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
      <main className="flex-1 bg-bg px-gouttiere pt-32 pb-24 font-texte text-text">
        <Panneau className="mx-auto max-w-contenu px-8 py-10">
          <p className="text-danger">Impossible de charger ce profil pour l&apos;instant. Réessaie dans un instant.</p>
        </Panneau>
      </main>
    );
  }

  const { profil, compteRiot, rating, historique, evenementsPoints, infoOffre, estProprietaire, visiteurs, offreVisiteur, dejaSuivi, peutRevue } = donnees;
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

  const complements = await chargerComplementsProfil(profil.id);
  const matchsVerifies = historique.filter((h) => h.niveau !== "manuel").length;
  const matchsManuels = historique.length - matchsVerifies;
  const defaites = matchsCalibres - victoires;
  // historique est trié du plus récent au plus ancien.
  const premierMatch = historique.length > 0 ? historique[historique.length - 1] : null;
  const courbe = complements.courbe;
  const deltaSaison =
    courbe.length > 1 ? arrondir(courbe[courbe.length - 1].rating) - arrondir(courbe[0].rating) : null;
  const equipeActuelle = complements.equipes[0] ?? null;
  const couleurPalier = complements.palier
    ? (COULEUR_PALIER[complements.palier.nom.toLowerCase()] ?? "var(--color-muted)")
    : null;

  const kpis = [
    {
      libelle: "Classement national",
      valeur: complements.rangNational ? `#${complements.rangNational}` : "—",
      sous: complements.rangNational
        ? `sur ${complements.totalClasses} joueur${complements.totalClasses > 1 ? "s" : ""} classé${complements.totalClasses > 1 ? "s" : ""}`
        : "Classé à partir de RD ≤ 150",
    },
    {
      libelle: "Palier",
      valeur: complements.palier?.nom ?? "—",
      sous: complements.palierSuivant
        ? `Prochain : ${complements.palierSuivant.nom} à ${complements.palierSuivant.ratingMin}`
        : complements.palier
          ? "Palier maximal"
          : "Après le premier tournoi",
      couleur: couleurPalier,
    },
    {
      libelle: "Victoires",
      valeur: tauxVictoire !== null ? `${tauxVictoire}%` : "—",
      sous: matchsCalibres > 0 ? `${victoires} V · ${defaites} D` : "Aucun match joué",
    },
    {
      libelle: "Matchs vérifiés",
      valeur: String(matchsVerifies),
      sous:
        matchsManuels > 0
          ? `+ ${matchsManuels} manuel${matchsManuels > 1 ? "s" : ""}, hors classement`
          : "Données officielles",
    },
  ];

  const moisAnnee = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });

  const parcours = [
    ...complements.equipes.map((e) => ({
      cle: `equipe-${e.slug}`,
      quand: e.depuis ? `Depuis ${moisAnnee.format(new Date(e.depuis))}` : "Équipe",
      titre: e.nom,
      lien: `/equipe/${e.slug}`,
      detail: e.estCapitaine ? "Capitaine" : (e.role ?? "Membre de l'équipe"),
    })),
    ...(premierMatch
      ? [
          {
            cle: "premier-match",
            quand: formaterDate(premierMatch.creeLe),
            titre: premierMatch.tournoi ? `Premier match — ${premierMatch.tournoi.nom}` : "Premier match",
            lien: premierMatch.tournoi ? `/lol/tournois/${premierMatch.tournoi.slug}` : null,
            detail: premierMatch.adversaire ? `Contre ${premierMatch.adversaire.pseudo}` : "",
          },
        ]
      : []),
    {
      cle: "arrivee",
      quand: moisAnnee.format(new Date(profil.created_at)),
      titre: "Arrivée sur Najarena",
      lien: null,
      detail: compteRiot?.verifie_le ? "Compte Riot vérifié" : "",
    },
  ];

  const infos = [
    compteRiot ? { cle: "Riot ID", valeur: `${compteRiot.riot_game_name}#${compteRiot.riot_tag_line}` } : null,
    complements.roleLibelle ? { cle: "Rôle", valeur: complements.roleLibelle } : null,
    compteRiot ? { cle: "Région", valeur: compteRiot.region } : null,
    profil.pays ? { cle: "Pays", valeur: profil.pays } : null,
    equipeActuelle ? { cle: "Équipe", valeur: equipeActuelle.nom } : null,
    { cle: "Membre depuis", valeur: moisAnnee.format(new Date(profil.created_at)) },
  ].filter((i): i is { cle: string; valeur: string } => i !== null);

  const CHAMP =
    "w-full rounded-bouton border border-line-strong bg-bg px-3 py-2.5 font-texte text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const SOMMAIRE = "list-none [&::-webkit-details-marker]:hidden";

  return (
    <main className="bg-bg font-texte text-text">
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

      {/* ================= 1. IDENTITÉ ================= */}
      <section className="relative isolate overflow-hidden px-gouttiere pt-32 pb-12">
        <div
          aria-hidden="true"
          className="absolute -top-[420px] -right-24 -z-10 aspect-square w-[800px] rounded-full bg-[radial-gradient(circle,rgba(182,255,59,.10)_0%,rgba(182,255,59,0)_65%)]"
        />
        <Image
          src="/brand/najarena-logo-blanc.svg"
          alt=""
          width={312}
          height={420}
          unoptimized
          aria-hidden="true"
          className="pointer-events-none absolute -top-14 right-[4%] -z-10 hidden h-[420px] w-auto opacity-[0.04] lg:block"
        />

        <div className="mx-auto flex max-w-contenu flex-col gap-8 lg:flex-row lg:items-end lg:gap-10">
          <AvatarJoueur
            pseudo={profil.pseudo}
            src={complements.avatarUrl}
            taille={150}
            className="h-24! w-24! text-5xl! shadow-[0_30px_60px_rgba(0,0,0,.6)] sm:h-[150px]! sm:w-[150px]! sm:text-7xl!"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <div className="flex flex-wrap items-center gap-3">
              {compteRiot?.verifie_le ? (
                <BadgeVerifie>Profil vérifié</BadgeVerifie>
              ) : (
                <span className="text-mini font-semibold text-muted uppercase">Riot ID non vérifié</span>
              )}
              {complements.annonce && (
                <>
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#3A3F3A]" />
                  <BadgeChercheEquipe />
                </>
              )}
              {infoOffre.offre !== "gratuit" && (
                <>
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#3A3F3A]" />
                  <span
                    className="inline-flex items-center gap-1.5 text-mini font-semibold whitespace-nowrap uppercase"
                    style={{ color: COULEUR_OFFRE[infoOffre.offre] }}
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: COULEUR_OFFRE[infoOffre.offre] }} />
                    {LABEL_OFFRE[infoOffre.offre]}
                  </span>
                </>
              )}
            </div>
            <h1 className="font-titre text-[clamp(3.25rem,6.7vw,6rem)] leading-[0.85] font-black tracking-[1px] [overflow-wrap:anywhere]">
              {profil.pseudo}
            </h1>
            <dl className="flex flex-wrap gap-x-7 gap-y-1.5 text-base text-text-2">
              {infos.map((i) => (
                <div key={i.cle} className="flex gap-1.5">
                  <dt className="text-faint">{i.cle}</dt>
                  <dd>· {i.valeur}</dd>
                </div>
              ))}
            </dl>
            {infoOffre.bio && <p className="max-w-xl text-text-2">{infoOffre.bio}</p>}
            {infoOffre.lien_externe && (
              <a
                href={infoOffre.lien_externe}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start text-sm text-text underline decoration-[rgba(245,245,244,0.3)] underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {infoOffre.lien_externe}
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-3.5 lg:justify-end">
            {estProprietaire ? (
              <>
                <BoutonPartager
                  chemin={`/joueur/${profil.slug}`}
                  titre={`${profil.pseudo} — CV e-sport Najarena`}
                  libelle="Partager mon CV"
                  className={classeBoutonContour()}
                />
                {peutRevue && (
                  <BoutonLien href={`/joueur/${profil.slug}/cv`} variante="contour">
                    Exporter mon CV
                  </BoutonLien>
                )}
                {!compteRiot?.verifie_le ? (
                  <BoutonLien href="/lier-riot">Lier mon Riot ID</BoutonLien>
                ) : peutPersonnaliser ? (
                  <BoutonLien href="#personnaliser">Modifier le profil</BoutonLien>
                ) : (
                  <BoutonLien href="/moi">Mon espace</BoutonLien>
                )}
              </>
            ) : (
              <>
                <BoutonPartager
                  chemin={`/joueur/${profil.slug}`}
                  titre={`${profil.pseudo} — CV e-sport Najarena`}
                  libelle="Partager le CV"
                  className={classeBoutonContour()}
                />
                {visiteurEstOrganisateur &&
                  (dejaSuivi ? (
                    <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold tracking-[2px] text-accent uppercase">
                      Suivi
                    </span>
                  ) : (
                    <form action={suivreJoueur}>
                      <input type="hidden" name="joueur_suivi_id" value={profil.id} />
                      <input type="hidden" name="retour" value={`/joueur/${profil.slug}`} />
                      <BoutonEnvoi variante="contour" libelleEnCours="Suivi…">
                        Suivre
                      </BoutonEnvoi>
                    </form>
                  ))}
                {visiteurEstOrganisateur && (
                  <details className="group">
                    <summary className={`${SOMMAIRE} ${classeBoutonPrincipal()}`}>Contacter</summary>
                    <form
                      action={demarrerConversation}
                      className="panneau mt-3 flex w-[min(360px,calc(100vw-3rem))] flex-col gap-3 p-4"
                    >
                      <input type="hidden" name="destinataire_id" value={profil.id} />
                      <input type="hidden" name="retour" value={`/joueur/${profil.slug}`} />
                      <label className="flex flex-col gap-2">
                        <span className="text-mini text-muted uppercase">Ton message</span>
                        <textarea
                          name="message"
                          rows={3}
                          maxLength={2000}
                          required
                          placeholder="Ton message…"
                          className={`${CHAMP} resize-none`}
                        />
                      </label>
                      <BoutonEnvoi libelleEnCours="Envoi…" className="self-start">
                        Envoyer
                      </BoutonEnvoi>
                    </form>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ================= 2. CHIFFRES CLÉS ================= */}
      <section className="px-gouttiere" aria-label="Chiffres clés">
        <div className="mx-auto grid max-w-contenu grid-cols-2 border-y border-[rgba(245,245,244,0.1)] lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 flex flex-col gap-2.5 border-b border-line py-8 lg:col-span-1 lg:border-r lg:border-b-0 lg:pr-8">
            <span className="text-mini text-muted uppercase">Rating</span>
            <div className="flex flex-wrap items-end gap-4">
              {rating ? (
                <ChiffreRating valeur={arrondir(rating.rating)} />
              ) : (
                // Pas encore de ligne de rating : on affiche le rating de départ
                // de tout joueur (CLAUDE.md §4), en gris, jamais comme un acquis.
                <span className="flex flex-col gap-1">
                  <span className="font-titre text-[clamp(4rem,5.8vw,5.25rem)] leading-[0.85] font-black text-faint tabular-nums">
                    {RATING_INITIAL}
                  </span>
                  <span className="text-xs text-muted">Rating de départ</span>
                </span>
              )}
              <div className="flex flex-col gap-1 pb-1">
                <IndicateurConfiance estClasse={Boolean(rating?.est_classe)} pct={pct} />
                <span className="text-xs text-faint tabular-nums">
                  RD {rating ? arrondir(rating.rd) : RD_INITIAL}
                </span>
              </div>
            </div>
          </div>
          {kpis.map((k, i) => (
            <div
              key={k.libelle}
              className={`flex flex-col gap-2.5 border-line py-8 ${i % 2 === 0 ? "border-r pr-4" : "pl-4"} ${
                i < 2 ? "border-b lg:border-b-0" : ""
              } lg:border-r lg:px-8 ${i === kpis.length - 1 ? "lg:border-r-0 lg:pr-0" : ""}`}
            >
              <span className="text-mini text-muted uppercase">{k.libelle}</span>
              <span className="flex items-center gap-2.5 font-titre text-[clamp(2.25rem,3.6vw,3.25rem)] leading-[0.9] font-black uppercase tabular-nums">
                {k.couleur && (
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: k.couleur }} />
                )}
                {k.valeur}
              </span>
              <span className="text-xs text-muted">{k.sous}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ================= COLONNES ================= */}
      <div className="px-gouttiere pt-12 pb-24">
        <div className="mx-auto grid max-w-contenu items-start gap-8 lg:grid-cols-[minmax(0,1fr)_312px]">
          <div className="flex min-w-0 flex-col gap-8">
            {/* Progression du rating */}
            <Panneau className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <LibelleSection as="h2">Progression du rating</LibelleSection>
                {complements.saison && (
                  <span className="rounded-bouton bg-[rgba(245,245,244,0.08)] px-3 py-1.5 text-mini font-semibold uppercase">
                    {complements.saison.nom ?? `Saison ${complements.saison.numero}`}
                  </span>
                )}
              </div>
              {courbe.length > 1 && deltaSaison !== null ? (
                <>
                  <p className="flex flex-wrap items-end gap-3.5">
                    <span
                      className={`font-titre text-[40px] leading-none font-black tabular-nums ${
                        deltaSaison > 0 ? "text-accent" : deltaSaison < 0 ? "text-danger" : ""
                      }`}
                    >
                      {deltaSaison > 0 ? `+${deltaSaison}` : deltaSaison}
                    </span>
                    <span className="pb-1 text-sm text-muted">depuis le début de la saison</span>
                  </p>
                  <CourbeProgression points={courbe} />
                </>
              ) : (
                <p className="text-muted">
                  La courbe se dessine à la clôture du premier tournoi de la saison : chaque variation de points y
                  ajoute un point.
                </p>
              )}
            </Panneau>

            {/* Historique des matchs */}
            <Panneau className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <LibelleSection as="h2">Historique des matchs</LibelleSection>
                <span className="text-xs text-muted tabular-nums">
                  {matchsVerifies} match{matchsVerifies > 1 ? "s" : ""} vérifié{matchsVerifies > 1 ? "s" : ""}
                </span>
              </div>
              {historique.length === 0 ? (
                <p className="text-muted">Aucun résultat enregistré pour l&apos;instant.</p>
              ) : (
                <>
                  <Tableau legende={`Historique des matchs de ${profil.pseudo}`}>
                    <thead>
                      <tr>
                        <th scope="col" className="w-14">
                          Rés.
                        </th>
                        <th scope="col">Date</th>
                        <th scope="col">Tournoi</th>
                        <th scope="col" className="text-right">
                          Preuve
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historique.map((h) => (
                        <Fragment key={h.matchId}>
                          <tr>
                            <td>
                              <PastilleResultat resultat={h.estGagnant ? "V" : "D"} />
                            </td>
                            <td className="text-[13px] tracking-[1px] whitespace-nowrap text-muted tabular-nums">
                              {formaterDate(h.creeLe)}
                            </td>
                            <td>
                              <span className="flex flex-col gap-0.5">
                                <span className="font-semibold">
                                  {h.tournoi ? (
                                    <Link
                                      href={`/lol/tournois/${h.tournoi.slug}`}
                                      className="hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                    >
                                      {h.tournoi.nom}
                                    </Link>
                                  ) : (
                                    "Tournoi"
                                  )}
                                </span>
                                <span className="text-xs text-faint">
                                  {h.adversaire ? (
                                    <>
                                      Contre{" "}
                                      <Link
                                        href={`/joueur/${h.adversaire.slug}`}
                                        className="text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                      >
                                        {h.adversaire.pseudo}
                                      </Link>
                                    </>
                                  ) : (
                                    "Adversaire inconnu"
                                  )}
                                </span>
                              </span>
                            </td>
                            <td className="text-right">
                              <span className="inline-flex flex-col items-end gap-1">
                                <BadgeVerdict niveau={h.niveau} compact />
                                {h.niveau === "manuel" && h.motif && (
                                  <span className="max-w-[220px] text-xs text-muted">Motif : {h.motif}</span>
                                )}
                              </span>
                            </td>
                          </tr>
                          {peutRevue && h.stats && (
                            <tr>
                              <td colSpan={4} className="pt-0">
                                <details>
                                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-mini font-semibold text-accent uppercase">
                                    Voir la revue
                                  </summary>
                                  <div className="panneau mt-1 flex flex-col gap-1.5 p-4 text-sm">
                                    <p className="text-xs text-muted tabular-nums">
                                      {h.stats.champion} · {h.stats.kills}/{h.stats.deaths}/{h.stats.assists} · {h.stats.cs} CS · {h.stats.orGagne} or
                                    </p>
                                    {h.revue ? (
                                      h.revue.map((phrase) => (
                                        <p key={phrase} className="text-text-2">
                                          {phrase}
                                        </p>
                                      ))
                                    ) : (
                                      <p className="text-muted">Pas encore assez de matchs pour comparer.</p>
                                    )}
                                  </div>
                                </details>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </Tableau>
                  <p className="text-xs leading-relaxed text-muted">
                    Seuls les résultats vérifiés (code tournoi, historique Riot) comptent pour le classement. Une
                    décision manuelle de l&apos;organisateur reste visible, avec son motif, mais hors classement.
                  </p>
                </>
              )}
            </Panneau>

            {/* Journal des points */}
            <Panneau className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <LibelleSection as="h2">Journal des points</LibelleSection>
                <p className="text-sm text-muted">
                  Chaque variation de points est enregistrée avec le rating avant et après : publique, et jamais
                  modifiée.
                </p>
              </div>
              {evenementsPoints.length === 0 ? (
                <p className="text-muted">
                  Aucune variation de points pour l&apos;instant — le rating évolue à la clôture d&apos;un tournoi.
                </p>
              ) : (
                <Tableau legende={`Journal des points de ${profil.pseudo}`}>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Motif</th>
                      <th scope="col" className="text-right">
                        Avant → après
                      </th>
                      <th scope="col" className="text-right">
                        Écart
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {evenementsPoints.map((e) => {
                      const ecart = arrondir(e.rating_apres) - arrondir(e.rating_avant);
                      const libelle =
                        e.motif === "tournoi"
                          ? (e.tournoi?.nom ?? "Tournoi")
                          : (LABEL_MOTIF[e.motif] ?? e.motif);
                      return (
                        <tr key={e.id}>
                          <td className="text-[13px] whitespace-nowrap text-muted tabular-nums">
                            {formaterDate(e.cree_le)}
                          </td>
                          <td className="font-semibold">
                            {e.motif === "tournoi" && e.tournoi ? (
                              <Link
                                href={`/lol/tournois/${e.tournoi.slug}`}
                                className="hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              >
                                {libelle}
                              </Link>
                            ) : (
                              libelle
                            )}
                          </td>
                          <td className="text-right text-sm whitespace-nowrap text-muted tabular-nums">
                            {arrondir(e.rating_avant)} → {arrondir(e.rating_apres)}
                          </td>
                          <td
                            className={`text-right font-bold tabular-nums ${
                              ecart > 0 ? "text-accent" : ecart < 0 ? "text-danger" : "text-muted"
                            }`}
                          >
                            {ecart > 0 ? `+${ecart}` : ecart}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Tableau>
              )}
            </Panneau>
          </div>

          <aside className="flex flex-col gap-8" aria-label="Informations complémentaires">
            {/* Disponibilité : l'annonce « cherche une équipe » réelle */}
            {complements.annonce ? (
              <Panneau className="flex flex-col gap-4 p-7">
                <LibelleSection as="h2">Disponibilité</LibelleSection>
                <BadgeChercheEquipe className="self-start" />
                {complements.annonce.message && <p className="text-sm text-text-2">{complements.annonce.message}</p>}
                <p className="text-xs text-faint">Annonce publiée le {formaterDate(complements.annonce.cree_le)}</p>
                <BoutonLien href="/lol/coequipiers" variante="secondaire" className="self-start text-sm">
                  Voir les annonces
                </BoutonLien>
              </Panneau>
            ) : (
              estProprietaire && (
                <Panneau className="flex flex-col gap-4 p-7">
                  <LibelleSection as="h2">Disponibilité</LibelleSection>
                  <p className="text-sm text-text-2">
                    Tu cherches une équipe ? Publie une annonce : le badge « Cherche une équipe » s&apos;affichera sur
                    ton profil.
                  </p>
                  <BoutonLien href="/lol/coequipiers" variante="secondaire" className="self-start text-sm">
                    Publier une annonce
                  </BoutonLien>
                </Panneau>
              )
            )}

            {/* Parcours */}
            <Panneau className="flex flex-col gap-6 p-7">
              <LibelleSection as="h2">Parcours</LibelleSection>
              <ol className="flex flex-col gap-5">
                {parcours.map((p, i) => (
                  <li key={p.cle} className="flex gap-4">
                    <span aria-hidden="true" className="flex flex-col items-center gap-1 pt-1.5">
                      <span className={`h-[9px] w-[9px] rounded-full border-2 ${i === 0 ? "border-accent" : "border-faint"}`} />
                      <span className="w-px flex-1 bg-[rgba(245,245,244,0.1)]" />
                    </span>
                    <span className="flex flex-col gap-1 pb-1">
                      <span className="text-[11px] tracking-[2px] text-faint uppercase">{p.quand}</span>
                      <span className="text-[15px] font-semibold">
                        {p.lien ? (
                          <Link
                            href={p.lien}
                            className="hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            {p.titre}
                          </Link>
                        ) : (
                          p.titre
                        )}
                      </span>
                      {p.detail && <span className="text-[13px] text-muted">{p.detail}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </Panneau>

            {/* Face-à-face : adversaires affrontés au moins deux fois */}
            {rivalites.length > 0 && (
              <Panneau className="flex flex-col gap-4 p-7">
                <LibelleSection as="h2">Face-à-face</LibelleSection>
                <ul className="flex flex-col">
                  {rivalites.map((r) => (
                    <li
                      key={r.slug}
                      className="flex items-center justify-between gap-3 border-b border-[rgba(245,245,244,0.06)] py-3 last:border-b-0"
                    >
                      <Link
                        href={`/joueur/${r.slug}`}
                        className="font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {r.pseudo}
                      </Link>
                      <span className="text-sm font-bold tabular-nums">
                        <span className="text-accent">{r.victoires} V</span>
                        <span className="text-faint"> · </span>
                        <span className="text-danger">{r.defaites} D</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Panneau>
            )}

            {estProprietaire && peutPersonnaliser && (
              <>
                <Panneau as="section" className="flex scroll-mt-28 flex-col gap-5 p-7">
                  <h2 id="personnaliser" className="scroll-mt-28 font-texte text-libelle font-medium text-muted uppercase">
                    Personnaliser mon profil
                  </h2>
                  <form action={mettreAJourBioProfile} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-mini text-muted uppercase">Bio (140 caractères max)</span>
                      <textarea
                        name="bio"
                        rows={3}
                        maxLength={140}
                        defaultValue={infoOffre.bio ?? ""}
                        placeholder="Ex. « Mid laner, dispo le soir, cherche une équipe compétitive »"
                        className={`${CHAMP} resize-none`}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-mini text-muted uppercase">Lien externe (réseaux, sponsor…)</span>
                      <input
                        name="lien_externe"
                        type="url"
                        defaultValue={infoOffre.lien_externe ?? ""}
                        placeholder="https://…"
                        className={CHAMP}
                      />
                    </label>
                    <BoutonEnvoi libelleEnCours="Enregistrement…" className="self-start">
                      Enregistrer
                    </BoutonEnvoi>
                  </form>
                </Panneau>

                <Panneau as="section" className="flex flex-col gap-4 p-7">
                  <LibelleSection as="h2">Qui a vu ton profil</LibelleSection>
                  {visiteurs.length === 0 ? (
                    <p className="text-sm text-muted">Personne n&apos;a encore consulté ton profil.</p>
                  ) : (
                    <ul className="flex flex-col">
                      {visiteurs.map((v) => (
                        <li
                          key={v.slug}
                          className="flex items-center justify-between gap-3 border-b border-[rgba(245,245,244,0.06)] py-3 last:border-b-0"
                        >
                          <Link
                            href={`/joueur/${v.slug}`}
                            className="text-sm font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            {v.pseudo}
                          </Link>
                          <span className="text-xs text-muted tabular-nums">{formaterDate(v.derniereVueLe)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panneau>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

