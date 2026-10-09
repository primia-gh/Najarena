import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  inscrireAgentLibre,
  inscrireEquipe,
  modifierAlignement,
  quitterAgentsLibres,
  sInscrireATournoi,
  seDesinscrire,
} from "@/lib/inscription-actions";
import { confirmerAgentLibre, confirmerMaPresence } from "@/lib/checkin-actions";
import { LABEL_ROLE, ROLES, type Role } from "@/lib/roles";
import { resumeFiche } from "@/lib/fiche-organisateur";
import { checkinEstOuvert } from "@/lib/checkin";
import { ouvrirLitige } from "@/lib/litige-actions";
import { declarerPret, reconnaitreDefaite } from "@/lib/match-actions";
import { SuiviTempsReel } from "@/components/SuiviTempsReel";
import { progressionPalier } from "@/lib/classement";
import { chancesSiExploit, ETAT_DE_DEPART, pourcentages, type EtatRating } from "@/lib/estimations";
import { probabiliteVictoire } from "@/lib/glicko2";
import { recitTournoi } from "@/lib/recit-tournoi";
import { COULEUR_PALIER } from "@/lib/paliers";
import {
  estVisiblePubliquement,
  formaterDate,
  type StatutPublic,
} from "@/lib/tournois";
import { chargerComplementsTournoi } from "@/lib/tournoi-vitrine";
import { evaluerClassement, libelleEnJeu } from "@/lib/tournoi-classe";
import type { ConditionVictoire } from "@/lib/conditions-1v1";
import { BadgeClassement, CriteresClassement } from "@/components/tournoi/TournoiClasse";
import BoutonLien from "@/components/design/BoutonLien";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonConfirmation from "@/components/ui/BoutonConfirmation";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import { CaseMatch, ColonnesBracket, type EtatMatch } from "@/components/tournoi/Bracket";
import {
  Deroulement,
  EnTeteTournoi,
  EssentielReglement,
  LegendeBracket,
  StatutTournoi,
  type EtatEtape,
  type InfoTournoi,
} from "@/components/tournoi/BlocsTournoi";
import OngletsTournoi from "@/components/tournoi/OngletsTournoi";
import SalleDeMatch, { type InfosSalleDeMatch, type JoueurAligne } from "@/components/tournoi/SalleDeMatch";
import FormulaireAlignement from "@/components/tournoi/FormulaireAlignement";
import {
  chargerEquipesCapitaine,
  chargerEquipesDesTournois,
  cleEquipe,
  equipeDuJoueur,
  type EquipeInscrite,
} from "@/lib/equipes-tournoi";
import { libelleEquipe, TAILLE_ALIGNEMENT } from "@/lib/cinq-contre-cinq";
import {
  issuePronostic,
  LIBELLE_ISSUE,
  partsPronostics,
  pointsPronostic,
  pronosticOuvert,
  type MatchPronostiquable,
} from "@/lib/pronostics";
import { chargerPronosticsTournoi } from "@/lib/pronostics-serveur";
import { pronostiquer } from "@/lib/pronostic-actions";
import { cashPrizesActifs, formaterEuros, LIBELLE_RANG } from "@/lib/dotations";
import { publicReserve, typeCommunaute } from "@/lib/ecoles";

// Refonte « Venin » du 24/09/2026 (design-system/najarena/pages/tournoi.md,
// maquette najarena-design/maquettes/tournoi.dc.html) : seule l'apparence a
// changé. chargerTournoi et les conditions d'inscription / de litige sont
// repris tels quels ; les informations ajoutées (type de bracket, niveau,
// prise en compte au classement) viennent de lib/tournoi-vitrine.ts.
// Bloc « Récompenses » seulement pour une dotation sponsorisée enregistrée
// en base, et tant que CASH_PRIZES_ACTIFS est allumé (audit N32, éteint par
// défaut) ; sinon « En jeu : points de classement ».

// "Non classé" n'est pas un palier réel (table tiers) : jamais de rating
// affiché tant que le RD n'est pas descendu sous le seuil de classement
// (CLAUDE.md §4) — voir joueur/[pseudo] pour le même traitement.
const COULEUR_NON_CLASSE = "var(--color-muted)";

const LABEL_INSCRIPTION: Record<string, string> = {
  inscrit: "Inscrit",
  confirme: "Présence confirmée",
  absent: "Absent",
  retire: "Retiré",
};

interface TournoiPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string; message?: string }>;
}

// cache : generateMetadata et la page partagent un seul chargement par
// requête (audit M12).
const chargerTournoi = cache(async (slug: string) => {
  const supabase = await createClient();

  const { data: tournoi, error: erreurTournoi } = await supabase
    .from("tournaments")
    .select(
      "id, slug, nom, format, capacite, region, statut, debute_le, checkin_ouvre_le, best_of, organisateur_id, game_id, season_id, condition_victoire, nature, reserve_membres, reserve_non_classes, communaute:communautes(id, slug, nom, type), objectif:echeances(nom)",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (erreurTournoi) {
    return { statut: "erreur" as const };
  }

  if (!tournoi || !estVisiblePubliquement(tournoi.statut)) {
    return { statut: "introuvable" as const };
  }

  // Étage 1 : ces requêtes ne dépendent que du tournoi déjà chargé,
  // jamais les unes des autres — lancées en parallèle plutôt qu'en série
  // (correctif du 13/09/2026, même logique que sur l'accueil).
  const [
    { data: organisateur },
    { data: userData },
    { data: inscriptionsData },
    { data: paliersData },
    { data: matchsData },
    equipes,
    { data: agentsLibresData },
    { data: ficheOrganisateur },
  ] = await Promise.all([
    supabase.from("profiles").select("pseudo, slug").eq("id", tournoi.organisateur_id).maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("registrations")
      .select("id, statut, seed, profile_id, equipe_nom, equipe_tag, profile:profiles(pseudo, slug)")
      .eq("tournament_id", tournoi.id)
      .order("seed", { ascending: true, nullsFirst: false }),
    supabase.from("tiers").select("nom, rating_min").eq("game_id", tournoi.game_id),
    supabase
      .from("matches")
      .select(
        "id, tour, position, statut, demarre_le, defaite_reconnue_par, match_participants(profile_id, slot, score, est_gagnant, pret_le, profile:profiles(pseudo, slug))",
      )
      .eq("tournament_id", tournoi.id)
      .order("tour", { ascending: true })
      .order("position", { ascending: true }),
    // Tournoi 5v5 (audit N21) : l'équipe et les cinq joueurs alignés
    // derrière chaque capitaine inscrit.
    tournoi.format === "5v5"
      ? chargerEquipesDesTournois(supabase, [tournoi.id])
      : Promise.resolve(new Map<string, EquipeInscrite>()),
    // Agents libres (audit N23) : joueurs sans équipe, formés en équipes au
    // lancement du bracket.
    tournoi.format === "5v5"
      ? supabase
          .from("agents_libres")
          .select("profile_id, role, statut, profile:profiles(pseudo, slug)")
          .eq("tournament_id", tournoi.id)
          .order("inscrit_le", { ascending: true })
      : Promise.resolve({ data: [] }),
    // Fiche publique de l'organisateur (audit N13).
    supabase.rpc("fiche_organisateur", { p_profile_id: tournoi.organisateur_id }).maybeSingle(),
  ]);

  const paliers = (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min }));
  const profileIds = (inscriptionsData ?? []).map((i) => i.profile_id);
  const matchIds = (matchsData ?? []).map((m) => m.id);

  // Salle de match : le match que le visiteur doit jouer (ou attend), et son
  // adversaire. Un match décidé passe « terminé » : il n'est plus retenu.
  // En 5v5, un joueur aligné joue le match de son capitaine (seul inscrit
  // dans le bracket).
  const moi = userData.user?.id;
  const monEquipe = moi && tournoi.format === "5v5" ? equipeDuJoueur(equipes, tournoi.id, moi) : undefined;
  const monRepresentant = monEquipe?.capitaineId ?? moi;
  const monMatch = monRepresentant
    ? (matchsData ?? []).find(
        (m) =>
          ["en_attente", "en_cours", "litige"].includes(m.statut) &&
          m.match_participants.some((p) => p.profile_id === monRepresentant),
      )
    : undefined;
  const adversaireId = monMatch?.match_participants.find((p) => p.profile_id !== monRepresentant)?.profile_id;
  const equipeAdverse = adversaireId ? equipes.get(cleEquipe(tournoi.id, adversaireId)) : undefined;
  const joueursAlignes = Array.from(equipes.values()).flatMap((e) => e.joueurs);
  const joueursDuMatch5v5 = monEquipe && equipeAdverse ? [...monEquipe.joueurs, ...equipeAdverse.joueurs] : [];

  // Étage 2 : dépendent des résultats de l'étage 1 (profileIds, matchIds,
  // userData) mais pas les unes des autres — parallélisées de même.
  const [
    { data: ratingsData },
    { data: departsData },
    { data: verdictsData },
    { data: litigesData },
    { data: monCompteRiot },
    { data: compteAdversaire },
    { data: profilsAlignesData },
    { data: comptesDuMatchData },
    mesEquipes,
    { data: monAdhesion },
    { data: monClassement },
  ] = await Promise.all([
    profileIds.length > 0
      ? (() => {
          // Rating de la saison du tournoi (un joueur a une ligne par saison).
          const requete = supabase
            .from("ratings")
            .select("profile_id, rating, rd, est_classe")
            .eq("game_id", tournoi.game_id)
            .in("profile_id", profileIds);
          return tournoi.season_id ? requete.eq("season_id", tournoi.season_id) : requete;
        })()
      : Promise.resolve({ data: [] }),
    // Tournoi clôturé : rating et RD de chacun au début du tournoi, tels que
    // le journal des points les a figés — base des chances estimées.
    supabase
      .from("rating_events")
      .select("profile_id, rating_avant, rd_avant")
      .eq("tournament_id", tournoi.id)
      .eq("motif", "tournoi"),
    matchIds.length > 0
      ? supabase
          .from("match_verdicts")
          .select("match_id, niveau, motif, gagnant_id")
          .in("match_id", matchIds)
          .eq("est_definitif", true)
      : Promise.resolve({ data: [] }),
    matchIds.length > 0 && userData.user
      ? supabase.from("disputes").select("match_id, ouvert_par, resolution").in("match_id", matchIds)
      : Promise.resolve({ data: [] }),
    // Compte Riot du visiteur : l'inscription l'exige vérifié, dans la
    // région du tournoi (s_inscrire_tournoi, docs/schema.sql).
    userData.user
      ? supabase
          .from("game_accounts")
          .select("region, verifie_le")
          .eq("profile_id", userData.user.id)
          .eq("game_id", tournoi.game_id)
          .eq("est_principal", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    adversaireId && tournoi.format !== "5v5"
      ? supabase
          .from("game_accounts")
          .select("riot_game_name, riot_tag_line, verifie_le")
          .eq("profile_id", adversaireId)
          .eq("game_id", tournoi.game_id)
          .eq("est_principal", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // 5v5 : pseudos des joueurs alignés (listes des équipes inscrites)…
    joueursAlignes.length > 0
      ? supabase.from("profiles").select("id, pseudo, slug").in("id", joueursAlignes)
      : Promise.resolve({ data: [] }),
    // … Riot ID des dix joueurs du match du visiteur (invitations)…
    joueursDuMatch5v5.length > 0
      ? supabase
          .from("game_accounts")
          .select("profile_id, riot_game_name, riot_tag_line, verifie_le")
          .in("profile_id", joueursDuMatch5v5)
          .eq("game_id", tournoi.game_id)
          .eq("est_principal", true)
      : Promise.resolve({ data: [] }),
    // … et les équipes dont il est capitaine, pour les inscrire.
    userData.user && tournoi.format === "5v5"
      ? chargerEquipesCapitaine(supabase, userData.user.id, tournoi.game_id, tournoi.region)
      : Promise.resolve([]),
    // Tournoi réservé aux membres de sa communauté (04/10/2026) : le
    // visiteur en est-il membre (vérifié, pour une école) ?
    userData.user && tournoi.reserve_membres && tournoi.communaute
      ? supabase
          .from("membres_communaute")
          .select("verifie_le")
          .eq("communaute_id", tournoi.communaute.id)
          .eq("profile_id", userData.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Coupe des nouveaux (idée en réserve n°12) : le visiteur est-il déjà
    // classé dans la saison en cours ? (même règle que est_non_classe)
    userData.user && tournoi.reserve_non_classes
      ? supabase
          .from("ratings")
          .select("est_classe, season:seasons!inner(est_courante)")
          .eq("profile_id", userData.user.id)
          .eq("game_id", tournoi.game_id)
          .eq("season.est_courante", true)
          .eq("est_classe", true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ratingParProfile = new Map((ratingsData ?? []).map((r) => [r.profile_id, r]));

  // État de départ de chaque joueur pour les chances estimées (audit N10) :
  // journal du tournoi s'il est clôturé, sinon rating actuel, sinon celui
  // de départ de tous.
  const departParProfile = new Map<string, EtatRating>(
    (departsData ?? []).map((d) => [d.profile_id, { rating: d.rating_avant, rd: d.rd_avant }]),
  );
  const etatDepart = (profileId: string): EtatRating => {
    const depart = departParProfile.get(profileId);
    if (depart) return depart;
    const actuel = ratingParProfile.get(profileId);
    return actuel ? { rating: actuel.rating, rd: actuel.rd } : ETAT_DE_DEPART;
  };
  const verdictParMatch = new Map((verdictsData ?? []).map((v) => [v.match_id, v]));
  const litigeParMatch = new Map((litigesData ?? []).map((l) => [l.match_id, l]));
  const profilParId = new Map((profilsAlignesData ?? []).map((p) => [p.id, p]));
  const riotIdParId = new Map(
    (comptesDuMatchData ?? [])
      .filter((c) => c.verifie_le)
      .map((c) => [c.profile_id, `${c.riot_game_name}#${c.riot_tag_line}`]),
  );
  const aligne = (profileId: string): JoueurAligne => ({
    pseudo: profilParId.get(profileId)?.pseudo ?? "Joueur",
    slug: profilParId.get(profileId)?.slug ?? "",
    riotId: riotIdParId.get(profileId) ?? null,
  });

  return {
    statut: "ok" as const,
    tournoi,
    organisateur,
    inscriptions: inscriptionsData ?? [],
    matchs: matchsData ?? [],
    verdictParMatch,
    litigeParMatch,
    utilisateur: userData.user,
    monCompteRiot,
    monMatch,
    riotIdAdversaire:
      compteAdversaire?.verifie_le ? `${compteAdversaire.riot_game_name}#${compteAdversaire.riot_tag_line}` : null,
    paliers,
    ratingParProfile,
    etatDepart,
    equipes,
    monEquipe,
    monRepresentant,
    equipeAdverse,
    aligne,
    mesEquipes,
    agentsLibres: agentsLibresData ?? [],
    resumeOrganisateur: ficheOrganisateur ? resumeFiche(ficheOrganisateur) : null,
    // Même règle que la base (eligible_tournoi_reserve), pour l'affichage.
    eligibleReserve:
      (!tournoi.reserve_membres ||
        (monAdhesion !== null &&
          (typeCommunaute(tournoi.communaute?.type) !== "ecole" || monAdhesion.verifie_le !== null))) &&
      (!tournoi.reserve_non_classes || monClassement === null),
  };
});

// Heure du match encore à venir (scrim programmé, audit N22). Hors des
// composants : la date courante ne se lit pas pendant le rendu.
function estAVenir(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() > Date.now();
}

// Pronostics (audit N20) : même raison, l'heure courante est lue ici.
function pronosticOuvertMaintenant(m: MatchPronostiquable): boolean {
  return pronosticOuvert(m, new Date());
}

function crestJoueur(
  profileId: string,
  ratingParProfile: Map<string, { rating: number; est_classe: boolean | null }>,
  paliers: { nom: string; ratingMin: number }[],
) {
  const rating = ratingParProfile.get(profileId);
  if (!rating || !rating.est_classe) {
    return { nom: "Non classé", couleur: COULEUR_NON_CLASSE, progression: 0 };
  }
  const { palier, progression } = progressionPalier(rating.rating, paliers);
  if (!palier) return { nom: "Non classé", couleur: COULEUR_NON_CLASSE, progression: 0 };
  return {
    nom: palier.nom,
    couleur: COULEUR_PALIER[palier.nom.toLowerCase()] ?? COULEUR_NON_CLASSE,
    progression,
  };
}

export async function generateMetadata({
  params,
}: TournoiPageProps): Promise<Metadata> {
  const { slug } = await params;
  const donnees = await chargerTournoi(slug);

  if (donnees.statut !== "ok") {
    return { title: "Tournoi introuvable — Najarena" };
  }

  const { tournoi } = donnees;
  // Duel entre deux joueurs (audit N16) ou scrim entre deux équipes (N22) :
  // page utile aux joueurs, pas une page à faire indexer.
  if (tournoi.nature !== "tournoi") {
    return { title: `${tournoi.nom} — Najarena`, robots: { index: false, follow: true } };
  }
  return {
    title: `${tournoi.nom} — Najarena`,
    description: `Tournoi League of Legends ${tournoi.format}${tournoi.best_of > 1 ? ` en Bo${tournoi.best_of}` : ""}, le ${formaterDate(tournoi.debute_le)} (heure de Paris), ${tournoi.capacite} joueurs, région ${tournoi.region}. Résultats lus dans la donnée officielle Riot.`,
    alternates: { canonical: `/lol/tournois/${tournoi.slug}` },
    openGraph: { title: `${tournoi.nom} — Najarena`, url: `/lol/tournois/${tournoi.slug}` },
  };
}

export default async function TournoiPage({ params, searchParams }: TournoiPageProps) {
  const { slug } = await params;
  const { erreur, message } = await searchParams;
  const donnees = await chargerTournoi(slug);

  if (donnees.statut === "introuvable") {
    notFound();
  }

  if (donnees.statut === "erreur") {
    return (
      <main className="flex-1 bg-bg px-gouttiere pt-32 pb-24 font-texte text-text">
        <Panneau className="mx-auto max-w-contenu px-8 py-10">
          <p className="text-danger">Impossible de charger ce tournoi pour l&apos;instant. Réessaie dans un instant.</p>
        </Panneau>
      </main>
    );
  }

  const {
    tournoi,
    organisateur,
    inscriptions,
    matchs,
    verdictParMatch,
    litigeParMatch,
    utilisateur,
    monCompteRiot,
    monMatch,
    riotIdAdversaire,
    paliers,
    ratingParProfile,
    etatDepart,
    equipes,
    monEquipe,
    monRepresentant,
    equipeAdverse,
    aligne,
    mesEquipes,
    agentsLibres,
    resumeOrganisateur,
    eligibleReserve,
  } = donnees;
  const compteRiotValide = Boolean(monCompteRiot?.verifie_le) && monCompteRiot?.region === tournoi.region;
  const statut = tournoi.statut as StatutPublic;
  // Duel issu d'un défi entre deux joueurs (audit N16), scrim entre deux
  // équipes (N22) : un match unique, arbitré par Najarena.
  const estDefi = tournoi.nature === "defi";
  const estScrim = tournoi.nature === "scrim";
  // Condition de victoire du tournoi (audit N5).
  const condition: ConditionVictoire = tournoi.condition_victoire === "classique" ? "classique" : "nexus";
  // Tournoi 5v5 (audit N21) : dans le bracket, chaque capitaine représente
  // son équipe — c'est elle qu'on affiche.
  const estEquipes = tournoi.format === "5v5";
  const equipeDe = (profileId: string) => (estEquipes ? equipes.get(cleEquipe(tournoi.id, profileId)) : undefined);
  const nomDe = (profileId: string, pseudo: string | null | undefined) =>
    equipeDe(profileId)?.libelle ?? pseudo ?? "Joueur inconnu";

  // Récit factuel du tournoi terminé (vainqueur, parcours, exploit, part de
  // matchs vérifiés) — src/lib/recit-tournoi.ts.
  const recit =
    statut === "termine"
      ? recitTournoi({
          nom: tournoi.nom,
          nbJoueurs: new Set(matchs.flatMap((m) => m.match_participants.map((p) => p.profile_id))).size,
          bestOf: tournoi.best_of,
          matchs: matchs.map((m) => {
            const verdict = verdictParMatch.get(m.id);
            return {
              tour: m.tour,
              participants: m.match_participants.map((p) => ({
                id: p.profile_id,
                pseudo: estEquipes ? nomDe(p.profile_id, p.profile?.pseudo) : (p.profile?.pseudo ?? "un joueur"),
                score: p.score,
              })),
              verdict: verdict ? { niveau: verdict.niveau, gagnantId: verdict.gagnant_id } : null,
            };
          }),
          // Chances d'après les ratings individuels : sans objet en 5v5.
          chances: estEquipes ? undefined : (g, p) => probabiliteVictoire(etatDepart(g), etatDepart(p)),
          equipes: estEquipes,
        })
      : null;
  const estOrganisateur = utilisateur?.id === tournoi.organisateur_id;
  // Une inscription retirée ne compte plus : le joueur retrouve le bouton
  // d'inscription (la base réactive alors la même ligne).
  const inscriptionActuelle = utilisateur
    ? inscriptions.find((i) => i.profile_id === utilisateur.id && i.statut !== "retire")
    : undefined;

  // Check-in fait par le joueur lui-même (24/09/2026, lib/checkin-actions.ts).
  const checkinOuvert = checkinEstOuvert(statut, tournoi.checkin_ouvre_le);
  const inscriptionsActives = inscriptions.filter((i) => i.statut !== "retire");
  const estComplet = inscriptionsActives.length >= tournoi.capacite;

  const rounds = new Map<number, typeof matchs>();
  for (const m of matchs) {
    const liste = rounds.get(m.tour) ?? [];
    liste.push(m);
    rounds.set(m.tour, liste);
  }
  const toursOrdonnes = Array.from(rounds.keys()).sort((a, b) => a - b);

  const complements = await chargerComplementsTournoi(tournoi.id);

  // Pronostics gratuits (audit N20) : demi-finales et finale d'un tournoi
  // (jamais d'un défi ni d'un scrim), dès que les deux adversaires sont
  // connus. Les joueurs du tournoi et l'organisateur ne pronostiquent pas.
  const matchsPronostic =
    tournoi.nature === "tournoi"
      ? matchs.filter((m) => pointsPronostic(m.tour, tournoi.capacite) > 0 && m.match_participants.length === 2)
      : [];
  const pronostics =
    matchsPronostic.length > 0
      ? await chargerPronosticsTournoi(
          await createClient(),
          tournoi.id,
          matchsPronostic.map((m) => m.id),
          utilisateur?.id,
        )
      : null;
  const peutPronostiquer = Boolean(utilisateur) && !estOrganisateur && !inscriptionActuelle && !monEquipe;

  // Cash prizes sponsorisés (audit N32) : rien n'est lu ni affiché tant
  // qu'ils sont désactivés.
  const { data: dotation } =
    cashPrizesActifs() && tournoi.nature === "tournoi"
      ? await (await createClient())
          .from("dotations")
          .select("sponsor_nom, sponsor_lien, repartition")
          .eq("tournament_id", tournoi.id)
          .eq("statut", "validee")
          .maybeSingle()
      : { data: null };

  // Tournoi classé (audit E12 / N12) : critères publics, décision figée par
  // la base à la clôture. Un tournoi terminé sans décision (clos sans
  // saison courante, ou amical) n'a rapporté aucun point.
  const joueursDuBracket = new Set(matchs.flatMap((m) => m.match_participants.map((p) => p.profile_id)));
  const classement = evaluerClassement({
    officiel: complements.estQuotidien,
    defi: estDefi,
    equipes: estEquipes,
    scrim: estScrim,
    amical: !complements.comptePourClassement,
    publieLe: complements.publieLe,
    debuteLe: tournoi.debute_le,
    joueursAuDepart: matchs.length > 0 ? joueursDuBracket.size : null,
    inscrits: inscriptionsActives.length,
    organisateurJoue:
      joueursDuBracket.has(tournoi.organisateur_id) ||
      inscriptions.some(
        (i) => i.profile_id === tournoi.organisateur_id && (i.statut === "inscrit" || i.statut === "confirme"),
      ),
    decision: complements.classe ?? (statut === "termine" ? false : null),
  });

  // Nom des colonnes : tous les tours sont créés dès la génération du
  // bracket (lib/organisation-actions.ts), le dernier est donc la finale.
  const libelleTour = (index: number) => {
    const reste = toursOrdonnes.length - index;
    if (reste === 1) return estDefi ? "Duel" : estScrim ? "Scrim" : "Finale";
    if (reste === 2) return "Demi-finales";
    if (reste === 3) return "Quarts";
    if (reste === 4) return "Huitièmes";
    return `Tour ${toursOrdonnes[index]}`;
  };

  const infosSalle: InfosSalleDeMatch | null =
    monMatch && utilisateur && statut === "en_cours"
      ? (() => {
          // En 5v5, le visiteur voit le match par son capitaine.
          const moiDansMatch = monMatch.match_participants.find((p) => p.profile_id === monRepresentant);
          const adversaire = monMatch.match_participants.find((p) => p.profile_id !== monRepresentant);
          const perdantDansMatch = monMatch.defaite_reconnue_par
            ? monMatch.match_participants.find((p) => p.profile_id === monMatch.defaite_reconnue_par)
            : undefined;
          const perdant = monMatch.defaite_reconnue_par
            ? estEquipes && perdantDansMatch
              ? nomDe(perdantDansMatch.profile_id, perdantDansMatch.profile?.pseudo)
              : (perdantDansMatch?.profile?.pseudo ?? "un joueur")
            : null;
          return {
            tour: libelleTour(toursOrdonnes.indexOf(monMatch.tour)),
            etat: !adversaire
              ? "attente_adversaire"
              : perdant
                ? "defaite_reconnue"
                : monMatch.statut === "litige"
                  ? "litige"
                  : "a_jouer",
            adversaire: adversaire?.profile
              ? estEquipes
                ? { pseudo: nomDe(adversaire.profile_id, adversaire.profile.pseudo), slug: "", riotId: null }
                : { pseudo: adversaire.profile.pseudo, slug: adversaire.profile.slug, riotId: riotIdAdversaire }
              : null,
            jeCreeLaPartie: moiDansMatch?.slot === 1,
            demarreLe: monMatch.demarre_le,
            bestOf: tournoi.best_of,
            perdantDeclare: perdant,
            chances:
              adversaire && !estEquipes
                ? (() => {
                    const [moi, lui] = pourcentages(etatDepart(utilisateur.id), etatDepart(adversaire.profile_id));
                    return { moi, adversaire: lui };
                  })()
                : null,
            // « Je suis prêt » de chacun (forfait automatique, audit N4) ;
            // pas de forfait pour un scrim (entraînement, audit N22).
            pret: estScrim
              ? undefined
              : { moi: moiDansMatch?.pret_le ?? null, adversaire: adversaire?.pret_le ?? null },
            aVenir: estAVenir(monMatch.demarre_le),
            condition,
            equipes:
              estEquipes && monEquipe
                ? {
                    estCapitaine: monEquipe.capitaineId === utilisateur.id,
                    slugAdverse: equipeAdverse?.slug ?? null,
                    nous: monEquipe.joueurs.map(aligne),
                    eux: (equipeAdverse?.joueurs ?? []).map(aligne),
                  }
                : null,
          };
        })()
      : null;

  const etapes: { titre: string; quand: string; etat: EtatEtape }[] =
    statut === "annule"
      ? [
          {
            titre: estDefi ? "Défi annulé" : estScrim ? "Scrim annulé" : "Tournoi annulé",
            quand: formaterDate(tournoi.debute_le),
            etat: "fait",
          },
        ]
      : estDefi || estScrim
        ? [
            {
              titre: estDefi ? "Défi relevé" : "Scrim accepté",
              quand: estDefi ? formaterDate(tournoi.debute_le) : "Fait",
              etat: "fait",
            },
            {
              titre: estDefi ? "Duel" : "Scrim",
              quand:
                statut === "termine"
                  ? "Terminé"
                  : estAVenir(tournoi.debute_le)
                    ? formaterDate(tournoi.debute_le)
                    : "En cours",
              etat: statut === "termine" ? "fait" : estAVenir(tournoi.debute_le) ? "a_venir" : "maintenant",
            },
          ]
      : [
          {
            titre: "Inscriptions",
            quand: statut === "ouvert" ? `Jusqu'au ${formaterDate(tournoi.checkin_ouvre_le)}` : "Terminées",
            etat: statut === "ouvert" ? "maintenant" : "fait",
          },
          {
            titre: "Check-in",
            quand:
              statut === "checkin" ? "En cours" : statut === "ouvert" ? formaterDate(tournoi.checkin_ouvre_le) : "Terminé",
            etat: statut === "checkin" ? "maintenant" : statut === "ouvert" ? "a_venir" : "fait",
          },
          ...(toursOrdonnes.length === 0
            ? [
                {
                  titre: "Début des matchs",
                  quand: formaterDate(tournoi.debute_le),
                  etat: (statut === "termine" ? "fait" : "a_venir") as EtatEtape,
                },
              ]
            : toursOrdonnes.map((tour, index) => {
                const matchsDuTour = rounds.get(tour) ?? [];
                const joues = matchsDuTour.filter((m) => verdictParMatch.has(m.id)).length;
                const etat: EtatEtape =
                  statut === "termine" || (matchsDuTour.length > 0 && joues === matchsDuTour.length)
                    ? "fait"
                    : joues > 0 || matchsDuTour.some((m) => m.statut === "en_cours")
                      ? "maintenant"
                      : "a_venir";
                return {
                  titre: libelleTour(index),
                  quand:
                    etat === "fait"
                      ? "Terminé"
                      : etat === "maintenant"
                        ? "En cours"
                        : index === 0
                          ? formaterDate(tournoi.debute_le)
                          : "Ensuite",
                  etat,
                };
              })),
        ];

  const infos: InfoTournoi[] = [
    {
      libelle: "En jeu",
      valeur: estScrim
        ? "Entraînement"
        : libelleEnJeu(classement.statut, !complements.comptePourClassement, estEquipes),
      grand: true,
      accent: classement.statut === "classe",
    },
    {
      libelle: estEquipes ? "Équipes" : "Inscrits",
      valeur: `${inscriptionsActives.length}/${tournoi.capacite}`,
      grand: true,
      accent: false,
    },
    { libelle: "Format", valeur: `${tournoi.format} · BO${tournoi.best_of}`, grand: false, accent: false },
    { libelle: "Niveau", valeur: complements.niveau, grand: false, accent: false },
  ];

  const CHAMP =
    "min-h-11 w-full rounded-bouton border border-line-strong bg-bg px-3 py-2.5 font-texte text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  const lienDiscret =
    "text-text underline decoration-[rgba(245,245,244,0.3)] underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  // Tournoi 5v5 (audit N21) : le capitaine inscrit son équipe, fait le
  // check-in et peut changer l'alignement ; les joueurs alignés suivent.
  const monInscriptionEquipe = estEquipes ? inscriptionActuelle : undefined;
  const equipeInscrite = monInscriptionEquipe && utilisateur ? equipeDe(utilisateur.id) : undefined;
  const equipeCapitaine = equipeInscrite ? mesEquipes.find((e) => e.slug === equipeInscrite.slug) : undefined;
  // Tournoi réservé aux membres de sa communauté (04/10/2026) : à qui il
  // est ouvert, et comment en faire partie.
  const reserve = tournoi.reserve_membres ? tournoi.communaute : null;
  const avisReserve = reserve ? (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-normal text-muted">
        Tournoi réservé aux {publicReserve(reserve)}.
      </p>
      <BoutonLien
        href={`/communaute/${reserve.slug}${typeCommunaute(reserve.type) === "ecole" ? "#ecole" : ""}`}
        className="w-full"
      >
        {typeCommunaute(reserve.type) === "ecole" ? "Vérifier mon adresse d'école" : "Rejoindre la communauté"}
      </BoutonLien>
    </div>
  ) : tournoi.reserve_membres ? (
    <p className="text-[13px] leading-normal text-muted">
      Tournoi réservé aux membres d&apos;une communauté qui n&apos;existe plus : les inscriptions sont closes.
    </p>
  ) : tournoi.reserve_non_classes ? (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-normal text-muted">
        Réservé aux joueurs pas encore classés cette saison : tu l&apos;es déjà. Retrouve-toi au tournoi quotidien.
      </p>
      <BoutonLien href="/lol/tournois" className="w-full">
        Voir les tournois
      </BoutonLien>
    </div>
  ) : null;
  // Agents libres (audit N23) : ceux qui attendent encore une équipe.
  const agentsEnAttente = agentsLibres.filter((a) => a.statut !== "place");
  const monAgent = utilisateur ? agentsEnAttente.find((a) => a.profile_id === utilisateur.id) : undefined;
  const formulaireAgentLibre =
    statut === "ouvert" && utilisateur && eligibleReserve ? (
      compteRiotValide ? (
        <form action={inscrireAgentLibre} className="flex flex-col gap-2 border-t border-line pt-[18px]">
          <input type="hidden" name="tournament_id" value={tournoi.id} />
          <input type="hidden" name="slug" value={tournoi.slug} />
          <p className="text-[13px] leading-normal text-muted">
            Pas d&apos;équipe ? Inscris-toi comme agent libre : au lancement du bracket, les agents libres sont
            regroupés en équipes de cinq, de niveau proche et aux rôles variés.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-mini text-muted uppercase">Ton rôle</span>
            <select name="role" defaultValue="" className={CHAMP}>
              <option value="">Peu importe</option>
              {ROLES.map((r: Role) => (
                <option key={r} value={r}>
                  {LABEL_ROLE[r]}
                </option>
              ))}
            </select>
          </label>
          <BoutonEnvoi variante="contour" libelleEnCours="Inscription…" className="w-full">
            M&apos;inscrire comme agent libre
          </BoutonEnvoi>
        </form>
      ) : (
        <p className="border-t border-line pt-[18px] text-[13px] leading-normal text-muted">
          Pas d&apos;équipe ? Avec un compte Riot vérifié sur {tournoi.region}, tu pourras t&apos;inscrire comme agent
          libre.{" "}
          <Link href="/lier-riot" className={lienDiscret}>
            Lier mon compte Riot
          </Link>
        </p>
      )
    ) : null;
  const actionEquipes = !estEquipes ? null : monInscriptionEquipe ? (
    <>
      {checkinOuvert && monInscriptionEquipe.statut === "inscrit" && (
        <form action={confirmerMaPresence} className="flex flex-col gap-2">
          <input type="hidden" name="tournament_id" value={tournoi.id} />
          <BoutonEnvoi libelleEnCours="Confirmation…" className="w-full">
            Confirmer la présence de l&apos;équipe
          </BoutonEnvoi>
          <p className="text-[13px] leading-normal text-muted">
            Check-in ouvert : sans confirmation avant le début, pas de place dans le bracket.
          </p>
        </form>
      )}
      {statut === "ouvert" && !checkinOuvert && monInscriptionEquipe.statut === "inscrit" && (
        <p className="text-[13px] leading-normal text-muted">
          Pense au check-in de l&apos;équipe : il ouvre le{" "}
          <span className="tabular-nums text-text-2">{formaterDate(tournoi.checkin_ouvre_le)}</span>.
        </p>
      )}
      <p className="flex items-center justify-between gap-3 border-t border-line pt-[18px] text-[13px]">
        <span className="min-w-0 truncate text-muted">
          {nomDe(monInscriptionEquipe.profile_id, monInscriptionEquipe.equipe_nom)}
        </span>
        <span className="shrink-0 font-bold text-accent uppercase">
          {LABEL_INSCRIPTION[monInscriptionEquipe.statut] ?? monInscriptionEquipe.statut}
        </span>
      </p>
      {(statut === "ouvert" || statut === "checkin") &&
        (monInscriptionEquipe.statut === "inscrit" || monInscriptionEquipe.statut === "confirme") && (
          <>
            {equipeCapitaine && (
              <details>
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[13px] text-text underline underline-offset-3 hover:text-accent [&::-webkit-details-marker]:hidden">
                  Modifier l&apos;alignement
                </summary>
                <FormulaireAlignement
                  action={modifierAlignement}
                  tournamentId={tournoi.id}
                  slug={tournoi.slug}
                  region={tournoi.region}
                  capitaineId={monInscriptionEquipe.profile_id}
                  membres={equipeCapitaine.membres}
                  coches={equipeInscrite?.joueurs ?? []}
                  libelle="Enregistrer l'alignement"
                />
              </details>
            )}
            <form action={seDesinscrire}>
              <input type="hidden" name="tournament_id" value={tournoi.id} />
              <input type="hidden" name="slug" value={tournoi.slug} />
              <BoutonConfirmation
                type="submit"
                confirmation="Désinscrire ton équipe de ce tournoi ? Sa place sera libérée."
                className="inline-flex min-h-11 items-center text-[13px] text-muted underline underline-offset-3 hover:text-text"
              >
                Désinscrire l&apos;équipe
              </BoutonConfirmation>
            </form>
          </>
        )}
    </>
  ) : monAgent ? (
    <>
      {checkinOuvert && monAgent.statut === "inscrit" && (
        <form action={confirmerAgentLibre} className="flex flex-col gap-2">
          <input type="hidden" name="tournament_id" value={tournoi.id} />
          <input type="hidden" name="slug" value={tournoi.slug} />
          <BoutonEnvoi libelleEnCours="Confirmation…" className="w-full">
            Confirmer ma présence
          </BoutonEnvoi>
          <p className="text-[13px] leading-normal text-muted">
            Check-in ouvert : seuls les agents libres confirmés sont placés dans une équipe.
          </p>
        </form>
      )}
      <p className="flex items-center justify-between gap-3 border-t border-line pt-[18px] text-[13px]">
        <span className="text-muted">
          Agent libre
          {monAgent.role && ROLES.includes(monAgent.role as Role) ? ` · ${LABEL_ROLE[monAgent.role as Role]}` : ""}
        </span>
        <span className="font-bold text-accent uppercase">
          {monAgent.statut === "confirme" ? "Présence confirmée" : "Inscrit"}
        </span>
      </p>
      <p className="text-[13px] leading-normal text-muted">
        Ton équipe sera formée au lancement du bracket, avec des joueurs de niveau proche : tu seras prévenu.
      </p>
      {(statut === "ouvert" || statut === "checkin") && (
        <form action={quitterAgentsLibres}>
          <input type="hidden" name="tournament_id" value={tournoi.id} />
          <input type="hidden" name="slug" value={tournoi.slug} />
          <BoutonConfirmation
            type="submit"
            confirmation="Ne plus être agent libre dans ce tournoi ?"
            className="inline-flex min-h-11 items-center text-[13px] text-muted underline underline-offset-3 hover:text-text"
          >
            Me retirer
          </BoutonConfirmation>
        </form>
      )}
    </>
  ) : monEquipe ? (
    <p className="flex flex-col gap-1 border-t border-line pt-[18px] text-[13px] leading-normal text-muted">
      <span>
        Tu es aligné avec <span className="font-semibold text-text">{monEquipe.libelle}</span>.
      </span>
      <span>Ton capitaine gère l&apos;inscription, le check-in et le « Je suis prêt » de l&apos;équipe.</span>
    </p>
  ) : statut === "ouvert" && estComplet ? (
    <p className="flex items-center justify-between gap-3 border-t border-line pt-[18px] text-[13px]">
      <span className="text-muted">Inscriptions</span>
      <span className="font-bold text-muted uppercase">Complet</span>
    </p>
  ) : statut === "ouvert" ? (
    !utilisateur ? (
      <BoutonLien href="/connexion" className="w-full">
        Se connecter pour inscrire ton équipe
      </BoutonLien>
    ) : !eligibleReserve ? (
      avisReserve
    ) : mesEquipes.length === 0 ? (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-normal text-muted">
          Ce tournoi se joue en équipe de {TAILLE_ALIGNEMENT} : c&apos;est le capitaine qui inscrit son équipe, avec
          cinq membres aux comptes Riot vérifiés ({tournoi.region}).
        </p>
        <BoutonLien href="/equipe/nouvelle" className="w-full">
          Créer mon équipe
        </BoutonLien>
        <Link href="/lol/coequipiers" className={`self-start text-[13px] ${lienDiscret}`}>
          Trouver des coéquipiers
        </Link>
        {formulaireAgentLibre}
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        {mesEquipes.map((e) =>
          e.membres.length < TAILLE_ALIGNEMENT ? (
            <p key={e.id} className="text-[13px] leading-normal text-muted">
              {libelleEquipe(e.tag, e.nom)} compte {e.membres.length} membre{e.membres.length > 1 ? "s" : ""} : il en
              faut {TAILLE_ALIGNEMENT} pour l&apos;inscrire.{" "}
              <Link href={`/equipe/${e.slug}`} className={lienDiscret}>
                Compléter l&apos;équipe
              </Link>
            </p>
          ) : (
            <details key={e.id} open={mesEquipes.length === 1}>
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[13px] font-semibold text-text uppercase hover:text-accent [&::-webkit-details-marker]:hidden">
                Inscrire {libelleEquipe(e.tag, e.nom)}
              </summary>
              <FormulaireAlignement
                action={inscrireEquipe}
                tournamentId={tournoi.id}
                slug={tournoi.slug}
                region={tournoi.region}
                teamId={e.id}
                capitaineId={utilisateur.id}
                membres={e.membres}
                coches={e.membres.slice(0, TAILLE_ALIGNEMENT).map((m) => m.profileId)}
                libelle="Inscrire l'équipe"
              />
            </details>
          ),
        )}
      </div>
    )
  ) : null;

  return (
    <main className="bg-bg font-texte text-text">
      {statut !== "termine" && statut !== "annule" && (
        <SuiviTempsReel
          canal={`tournoi-${tournoi.id}`}
          tables={["matches", "match_participants", "match_verdicts", "registrations", "disputes"]}
        />
      )}

      {/* ================= EN-TÊTE D'AFFICHE ================= */}
      <EnTeteTournoi
        nom={tournoi.nom}
        etiquettes={
          <>
            <StatutTournoi statut={statut} />
            {statut !== "annule" && <BadgeClassement statut={classement.statut} />}
            <span className="text-text-2">
              LoL · {tournoi.format}
              {estDefi
                ? " · Défi en une partie"
                : estScrim
                  ? ` · Scrim (entraînement)${tournoi.objectif ? ` — préparation de ${tournoi.objectif.nom}` : ""}`
                  : complements.typeBracket
                    ? ` · ${complements.typeBracket}`
                    : ""}
              {complements.estQuotidien ? " · Tournoi quotidien" : ""}
              {complements.estALaDemande ? " · Tournoi à la demande" : ""}
              {condition === "classique" ? " · 1v1 classique" : ""}
              {tournoi.reserve_membres ? " · Réservé aux membres" : ""}
              {tournoi.reserve_non_classes ? " · Réservé aux joueurs non classés" : ""}
            </span>
          </>
        }
        details={
          <>
            <span className="tabular-nums">{formaterDate(tournoi.debute_le)}</span> · {tournoi.region}
            {(statut === "ouvert" || statut === "checkin") && (
              <>
                {" "}
                ·{" "}
                <a
                  href={`/lol/tournois/${tournoi.slug}/agenda`}
                  className="text-text underline decoration-[rgba(245,245,244,0.3)] underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Ajouter à mon agenda
                </a>
              </>
            )}
            {(estDefi || estScrim) && " · Arbitré par Najarena"}
            {organisateur && !estDefi && !estScrim && (
              <>
                {" "}
                · Organisé par{" "}
                <Link
                  href={`/joueur/${organisateur.slug}`}
                  className="text-text underline decoration-[rgba(245,245,244,0.3)] underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {organisateur.pseudo}
                </Link>
                {resumeOrganisateur && <span className="text-muted"> ({resumeOrganisateur})</span>}
                {/* Communauté (audit N30). */}
                {tournoi.communaute && (
                  <>
                    {" "}
                    · Communauté{" "}
                    <Link
                      href={`/communaute/${tournoi.communaute.slug}`}
                      className="text-text underline decoration-[rgba(245,245,244,0.3)] underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {tournoi.communaute.nom}
                    </Link>
                  </>
                )}
              </>
            )}{" "}
            · Résultats vérifiés automatiquement
          </>
        }
        infos={infos}
        action={
          <>
            {erreur && (
              <p role="alert" className="rounded-bouton border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                {erreur}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-bouton border border-accent/40 bg-accent/8 px-3 py-2.5 text-sm text-accent">
                {message}
              </p>
            )}

            {estOrganisateur ? (
              <BoutonLien href={`/moi/organisation/${tournoi.id}`} className="w-full">
                Gérer ce tournoi
              </BoutonLien>
            ) : estEquipes ? (
              actionEquipes
            ) : inscriptionActuelle ? (
              <>
                {checkinOuvert && inscriptionActuelle.statut === "inscrit" && (
                  <form action={confirmerMaPresence} className="flex flex-col gap-2">
                    <input type="hidden" name="tournament_id" value={tournoi.id} />
                    <BoutonEnvoi libelleEnCours="Confirmation…" className="w-full">
                      Confirmer ma présence
                    </BoutonEnvoi>
                    <p className="text-[13px] leading-normal text-muted">
                      Check-in ouvert : sans confirmation avant le début, pas de place dans le bracket.
                    </p>
                  </form>
                )}
                {statut === "ouvert" && !checkinOuvert && inscriptionActuelle.statut === "inscrit" && (
                  <p className="text-[13px] leading-normal text-muted">
                    Pense au check-in : il ouvre le{" "}
                    <span className="tabular-nums text-text-2">{formaterDate(tournoi.checkin_ouvre_le)}</span>.
                  </p>
                )}
                <p className="flex items-center justify-between gap-3 border-t border-line pt-[18px] text-[13px]">
                  <span className="text-muted">Ton inscription</span>
                  <span
                    className={`font-bold uppercase ${
                      inscriptionActuelle.statut === "absent" || inscriptionActuelle.statut === "retire"
                        ? "text-muted"
                        : "text-accent"
                    }`}
                  >
                    {LABEL_INSCRIPTION[inscriptionActuelle.statut] ?? inscriptionActuelle.statut}
                  </span>
                </p>
                {(statut === "ouvert" || statut === "checkin") &&
                  (inscriptionActuelle.statut === "inscrit" || inscriptionActuelle.statut === "confirme") && (
                    <form action={seDesinscrire}>
                      <input type="hidden" name="tournament_id" value={tournoi.id} />
                      <input type="hidden" name="slug" value={tournoi.slug} />
                      <BoutonConfirmation
                        type="submit"
                        confirmation="Te désinscrire de ce tournoi ? Ta place sera libérée."
                        className="inline-flex min-h-11 items-center text-[13px] text-muted underline underline-offset-3 hover:text-text"
                      >
                        Me désinscrire
                      </BoutonConfirmation>
                    </form>
                  )}
              </>
            ) : statut === "ouvert" && estComplet ? (
              <p className="flex items-center justify-between gap-3 border-t border-line pt-[18px] text-[13px]">
                <span className="text-muted">Inscriptions</span>
                <span className="font-bold text-muted uppercase">Complet</span>
              </p>
            ) : statut === "ouvert" ? (
              utilisateur && !eligibleReserve ? (
                avisReserve
              ) : utilisateur && !compteRiotValide ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] leading-normal text-muted">
                    {monCompteRiot?.verifie_le
                      ? `Ce tournoi se joue sur ${tournoi.region} : ton compte Riot vérifié est sur ${monCompteRiot.region}.`
                      : `Pour t'inscrire, lie et vérifie ton compte Riot (région ${tournoi.region}) : c'est lui qui permet de retrouver tes résultats automatiquement.`}
                  </p>
                  {!monCompteRiot?.verifie_le && (
                    <BoutonLien href="/lier-riot" className="w-full">
                      Lier mon compte Riot
                    </BoutonLien>
                  )}
                </div>
              ) : utilisateur ? (
                <form action={sInscrireATournoi}>
                  <input type="hidden" name="tournament_id" value={tournoi.id} />
                  <input type="hidden" name="slug" value={tournoi.slug} />
                  <BoutonEnvoi libelleEnCours="Inscription…" className="w-full">
                    S&apos;inscrire
                  </BoutonEnvoi>
                </form>
              ) : (
                <BoutonLien href="/connexion" className="w-full">
                  Se connecter pour s&apos;inscrire
                </BoutonLien>
              )
            ) : null}
          </>
        }
      />

      <OngletsTournoi />

      {infosSalle && (
        <section id="ton-match" className="scroll-mt-28 px-gouttiere pt-12">
          <div className="mx-auto max-w-contenu">
            <SalleDeMatch
              infos={infosSalle}
              actionPret={
                monMatch ? (
                  <form action={declarerPret}>
                    <input type="hidden" name="match_id" value={monMatch.id} />
                    <input type="hidden" name="slug" value={tournoi.slug} />
                    <BoutonEnvoi libelleEnCours="Envoi…" className="w-full sm:w-auto">
                      Je suis prêt
                    </BoutonEnvoi>
                  </form>
                ) : undefined
              }
              actions={
                (infosSalle.etat === "a_jouer" || infosSalle.etat === "litige") && monMatch ? (
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-mini font-semibold text-muted uppercase hover:text-text [&::-webkit-details-marker]:hidden">
                      J&apos;ai perdu ce match
                    </summary>
                    <form action={reconnaitreDefaite} className="flex flex-col gap-2">
                      <input type="hidden" name="match_id" value={monMatch.id} />
                      <input type="hidden" name="slug" value={tournoi.slug} />
                      <p className="text-xs leading-normal text-muted">
                        Ton adversaire avance sans attendre l&apos;organisateur. Si la partie est retrouvée chez Riot, le
                        résultat compte au classement ; sinon, il est enregistré sur ta parole, hors classement.
                      </p>
                      <BoutonEnvoi variante="contour" libelleEnCours="Envoi…" className="self-start">
                        Confirmer ma défaite
                      </BoutonEnvoi>
                    </form>
                  </details>
                ) : undefined
              }
            />
          </div>
        </section>
      )}

      {/* ================= RÉCIT (tournoi terminé, audit N26) ================= */}
      {recit && (
        <section aria-labelledby="titre-recit" className="px-gouttiere pt-12">
          <Panneau className="mx-auto flex max-w-contenu flex-col gap-3 px-6 py-6 sm:px-8">
            <LibelleSection as="h2" id="titre-recit">
              Le tournoi en bref
            </LibelleSection>
            <div className="flex max-w-3xl flex-col gap-2 text-sm leading-relaxed text-text-2">
              {recit.map((phrase) => (
                <p key={phrase}>{phrase}</p>
              ))}
            </div>
          </Panneau>
        </section>
      )}

      {/* ================= RÉCOMPENSES (audit N32) ================= */}
      {dotation && (
        <section id="recompenses" className="scroll-mt-28 px-gouttiere pt-12">
          <div className="mx-auto flex max-w-contenu flex-col gap-4">
            <LibelleSection as="h2">Récompenses</LibelleSection>
            <Panneau className="flex flex-col gap-3 p-6">
              <p className="text-sm text-text-2">
                Offertes par{" "}
                {dotation.sponsor_lien ? (
                  <a
                    href={dotation.sponsor_lien}
                    target="_blank"
                    rel="sponsored nofollow noopener noreferrer"
                    className="font-semibold text-text underline underline-offset-3"
                  >
                    {dotation.sponsor_nom}
                  </a>
                ) : (
                  <span className="font-semibold text-text">{dotation.sponsor_nom}</span>
                )}
                . Inscription gratuite.
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {dotation.repartition.map((centimes, i) => (
                  <li key={i} className="flex justify-between gap-4 border-b border-line py-1">
                    <span>{LIBELLE_RANG[i + 1]}</span>
                    <span className="font-semibold tabular-nums">{formaterEuros(centimes)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Versées après la fin du tournoi et la vérification d&apos;identité des gagnants. Un résultat tranché à
                la main est vérifié avant tout versement.
              </p>
            </Panneau>
          </div>
        </section>
      )}

      {/* ================= BRACKET ================= */}
      <section id="bracket" className="scroll-mt-28 px-gouttiere pt-12">
        <div className="mx-auto flex max-w-contenu flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LibelleSection as="h2">Bracket</LibelleSection>
            <LegendeBracket avecEstimations />
          </div>

          {toursOrdonnes.length === 0 ? (
            <Panneau reperes className="px-8 py-10">
              <p className="text-muted">Le bracket n&apos;a pas encore été généré.</p>
            </Panneau>
          ) : (
            <ColonnesBracket
              legende={`Bracket du tournoi ${tournoi.nom}`}
              tours={toursOrdonnes.map((tour, indexTour) => ({
                numero: tour,
                libelle: libelleTour(indexTour),
                matchs: rounds.get(tour)!.map((m) => {
                  const verdict = verdictParMatch.get(m.id);
                  const litige = litigeParMatch.get(m.id);
                  // En 5v5, tout joueur aligné voit le match de son équipe
                  // comme le sien ; seul le capitaine signale un litige.
                  const estParticipantDuMatch = monRepresentant
                    ? m.match_participants.some((p) => p.profile_id === monRepresentant)
                    : false;
                  const jeJoueCeMatch = utilisateur
                    ? m.match_participants.some((p) => p.profile_id === utilisateur.id)
                    : false;
                  const peutSignalerLitige = jeJoueCeMatch && verdict && !litige;
                  const enJeu =
                    !verdict && (m.statut === "en_cours" || m.statut === "litige") && m.match_participants.length === 2;
                  const perdantDansMatch = m.defaite_reconnue_par
                    ? m.match_participants.find((p) => p.profile_id === m.defaite_reconnue_par)
                    : undefined;
                  const perdantDeclare = m.defaite_reconnue_par
                    ? perdantDansMatch
                      ? nomDe(perdantDansMatch.profile_id, perdantDansMatch.profile?.pseudo)
                      : "un joueur"
                    : null;
                  const etat: EtatMatch =
                    litige && !litige.resolution
                      ? "litige"
                      : !verdict && m.statut === "litige"
                        ? "attente"
                        : verdict
                          ? "verdict"
                          : m.statut === "en_cours"
                            ? "direct"
                            : "a_venir";
                  const libelleMatch = m.match_participants
                    .map((p) => nomDe(p.profile_id, p.profile?.pseudo))
                    .join(" vs ");
                  // Chances estimées (match à jouer) et exploit (victoire
                  // vérifiée d'un joueur donné perdant) — audit N10.
                  const duo = [...m.match_participants].sort((a, b) => a.slot - b.slot);
                  const chances =
                    duo.length === 2 && !estEquipes
                      ? pourcentages(etatDepart(duo[0].profile_id), etatDepart(duo[1].profile_id))
                      : null;
                  const perdantVerifie =
                    verdict && verdict.niveau !== "manuel" && verdict.gagnant_id
                      ? duo.find((p) => p.profile_id !== verdict.gagnant_id)
                      : undefined;
                  const exploit =
                    verdict?.gagnant_id && perdantVerifie && !estEquipes
                      ? chancesSiExploit(etatDepart(verdict.gagnant_id), etatDepart(perdantVerifie.profile_id))
                      : null;
                  return {
                    id: m.id,
                    joue: Boolean(verdict),
                    atteint: m.match_participants.length > 0,
                    contenu: (
                      <CaseMatch
                        participants={duo.map((p, i) => ({
                          cle: p.profile_id,
                          pseudo: estEquipes ? nomDe(p.profile_id, p.profile?.pseudo) : (p.profile?.pseudo ?? null),
                          slug: estEquipes ? null : (p.profile?.slug ?? null),
                          lien: estEquipes
                            ? equipeDe(p.profile_id)?.slug
                              ? `/equipe/${equipeDe(p.profile_id)?.slug}`
                              : null
                            : undefined,
                          score: p.score,
                          estGagnant: p.est_gagnant,
                          chances: chances ? chances[i] : null,
                        }))}
                        etat={etat}
                        niveau={verdict?.niveau}
                        motif={verdict?.motif}
                        monMatch={estParticipantDuMatch}
                        exploit={exploit}
                        lienPreuve={`/lol/match/${m.id}`}
                      >
                        {!verdict && m.statut === "litige" && !perdantDeclare && (
                          <p className="text-xs text-danger">
                            Partie pas encore retrouvée chez Riot — la recherche continue, l&apos;organisateur peut
                            trancher.
                          </p>
                        )}
                        {enJeu && perdantDeclare && (
                          <p className="text-xs text-muted">
                            Défaite reconnue par {perdantDeclare} — en attente de l&apos;historique Riot (20 min au
                            plus).
                          </p>
                        )}
                        {enJeu && !perdantDeclare && estParticipantDuMatch && (
                          <a
                            href="#ton-match"
                            className="inline-flex min-h-11 items-center text-mini font-semibold text-accent uppercase underline underline-offset-3"
                          >
                            {estEquipes ? "Votre match : équipes et règles" : "Ton match : adversaire et règles"}
                          </a>
                        )}
                        {litige && (
                          <p className={`text-xs ${litige.resolution ? "text-muted" : "text-danger"}`}>
                            {litige.resolution ? "Litige résolu." : "Litige signalé — en attente de l'organisateur."}
                          </p>
                        )}
                        {peutSignalerLitige && (
                          <details>
                            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-mini font-semibold text-danger uppercase [&::-webkit-details-marker]:hidden">
                              Signaler un litige
                            </summary>
                            <form action={ouvrirLitige} className="flex flex-col gap-2">
                              <input type="hidden" name="match_id" value={m.id} />
                              <input type="hidden" name="slug" value={tournoi.slug} />
                              <label className="flex flex-col gap-1.5">
                                <span className="text-mini text-muted uppercase">
                                  Motif<span className="sr-only"> du litige — {libelleMatch}</span>
                                </span>
                                <input
                                  name="motif"
                                  type="text"
                                  required
                                  placeholder="Ce qui ne va pas dans ce résultat"
                                  className={CHAMP}
                                />
                              </label>
                              <BoutonEnvoi
                                variante="contour"
                                libelleEnCours="Envoi…"
                                aria-label={`Signaler un litige — ${libelleMatch}`}
                                className="self-start"
                              >
                                Envoyer
                              </BoutonEnvoi>
                            </form>
                          </details>
                        )}
                      </CaseMatch>
                    ),
                  };
                }),
              }))}
            />
          )}
        </div>
      </section>

      {/* ================= PRONOSTICS ================= */}
      {pronostics && (
        <section id="pronostics" className="scroll-mt-28 px-gouttiere pt-section-outil">
          <div className="mx-auto flex max-w-contenu flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <LibelleSection as="h2">Pronostics</LibelleSection>
              <Link
                href="/lol/pronostics"
                className="inline-flex min-h-11 items-center text-mini font-semibold text-accent uppercase underline underline-offset-3"
              >
                Classement des pronostiqueurs
              </Link>
            </div>
            <p className="max-w-2xl text-sm text-muted">
              Qui gagne ? Demi-finale juste = 1 point, finale = 2 points, comptés seulement sur un résultat lu chez
              Riot. Aucune mise, aucun gain : un classement des pronostiqueurs, rien d&apos;autre. Fermé dès qu&apos;un
              joueur se déclare prêt.
            </p>
            <ul className="grid gap-4 md:grid-cols-2">
              {matchsPronostic.map((m) => {
                const verdict = verdictParMatch.get(m.id);
                const duo = [...m.match_participants].sort((a, b) => a.slot - b.slot);
                const parJoueur = pronostics.repartition.get(m.id);
                const nombres = duo.map((p) => parJoueur?.get(p.profile_id) ?? 0);
                const parts = partsPronostics(nombres[0], nombres[1]);
                const total = nombres[0] + nombres[1];
                const monChoix = pronostics.miens.get(m.id);
                const ouvert = pronosticOuvertMaintenant({
                  statutTournoi: statut,
                  statutMatch: m.statut,
                  demarreLe: m.demarre_le,
                  nbParticipants: duo.length,
                  unJoueurPret: duo.some((p) => p.pret_le),
                  aUnVerdict: Boolean(verdict),
                });
                const issue = monChoix
                  ? issuePronostic(monChoix, verdict ? { niveau: verdict.niveau, gagnantId: verdict.gagnant_id } : null)
                  : null;
                return (
                  <li key={m.id}>
                    <Panneau className="flex h-full flex-col gap-3 p-5">
                      <p className="text-mini text-muted uppercase">
                        {pointsPronostic(m.tour, tournoi.capacite) === 2
                          ? "Finale · 2 points"
                          : "Demi-finale · 1 point"}
                      </p>
                      <ul className="flex flex-col gap-2">
                        {duo.map((p, i) => (
                          <li key={p.profile_id} className="flex flex-col gap-1">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className={monChoix === p.profile_id ? "font-semibold text-accent" : "text-text"}>
                                {nomDe(p.profile_id, p.profile?.pseudo)}
                              </span>
                              <span className="text-muted tabular-nums">{total > 0 ? `${parts[i]} %` : "—"}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                              <div className="h-full bg-accent/70" style={{ width: `${parts[i]}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted tabular-nums">
                        {total} pronostic{total > 1 ? "s" : ""}
                        {issue && monChoix
                          ? ` · ton choix : ${nomDe(monChoix, duo.find((p) => p.profile_id === monChoix)?.profile?.pseudo)} — ${LIBELLE_ISSUE[issue]}`
                          : ""}
                      </p>
                      {ouvert && peutPronostiquer && (
                        <div className="flex flex-wrap gap-2">
                          {duo.map((p) => (
                            <form key={p.profile_id} action={pronostiquer}>
                              <input type="hidden" name="match_id" value={m.id} />
                              <input type="hidden" name="gagnant_id" value={p.profile_id} />
                              <input type="hidden" name="slug" value={tournoi.slug} />
                              <BoutonEnvoi
                                variante={monChoix === p.profile_id ? "principal" : "contour"}
                                libelleEnCours="Envoi…"
                              >
                                {nomDe(p.profile_id, p.profile?.pseudo)}
                              </BoutonEnvoi>
                            </form>
                          ))}
                        </div>
                      )}
                      {ouvert && !utilisateur && (
                        <Link
                          href={`/connexion?suite=${encodeURIComponent(`/lol/tournois/${tournoi.slug}#pronostics`)}`}
                          className="inline-flex min-h-11 items-center text-mini font-semibold text-accent uppercase underline underline-offset-3"
                        >
                          Se connecter pour pronostiquer
                        </Link>
                      )}
                      {!ouvert && !verdict && (
                        <p className="text-xs text-muted">Pronostics fermés : le match a commencé.</p>
                      )}
                    </Panneau>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ================= INSCRITS ================= */}
      <section id="inscrits" className="scroll-mt-28 px-gouttiere pt-section-outil">
        <div className="mx-auto flex max-w-contenu flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <LibelleSection as="h2">{estEquipes ? "Équipes inscrites" : "Inscrits"}</LibelleSection>
            <span className="text-xs text-muted tabular-nums">
              {inscriptionsActives.length} / {tournoi.capacite} places
            </span>
          </div>
          {inscriptionsActives.length === 0 ? (
            <Panneau reperes className="px-8 py-10">
              <p className="text-muted">Aucune inscription pour l&apos;instant.</p>
            </Panneau>
          ) : estEquipes ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inscriptionsActives.map((i) => {
                const equipe = equipeDe(i.profile_id);
                const nous = monEquipe?.capitaineId === i.profile_id;
                return (
                  <li
                    key={i.id}
                    className={`panneau flex flex-col gap-2.5 px-4 py-3 ${nous ? "border-l-[3px] border-l-accent!" : ""}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      {equipe?.slug ? (
                        <Link
                          href={`/equipe/${equipe.slug}`}
                          className="truncate font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {nomDe(i.profile_id, i.equipe_nom)}
                        </Link>
                      ) : (
                        <span className="truncate font-semibold">{nomDe(i.profile_id, i.equipe_nom)}</span>
                      )}
                      <span className="shrink-0 text-mini text-muted uppercase tabular-nums">
                        {i.seed ? `Seed ${i.seed}` : (LABEL_INSCRIPTION[i.statut] ?? i.statut)}
                      </span>
                    </span>
                    <span className="text-xs leading-relaxed text-muted">
                      {equipe && equipe.joueurs.length > 0
                        ? equipe.joueurs.map((id) => aligne(id).pseudo).join(" · ")
                        : "Alignement à compléter"}
                      {equipe && equipe.joueurs.length > 0 && equipe.joueurs.length < TAILLE_ALIGNEMENT && (
                        <span className="text-danger"> — alignement incomplet</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inscriptionsActives.map((i) => {
                const crest = crestJoueur(i.profile_id, ratingParProfile, paliers);
                const moi = utilisateur?.id === i.profile_id;
                return (
                  <li
                    key={i.id}
                    className={`panneau flex items-center justify-between gap-3 px-4 py-3 ${moi ? "border-l-[3px] border-l-accent!" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <AvatarJoueur pseudo={i.profile?.pseudo ?? "?"} taille={34} />
                      <span className="flex min-w-0 flex-col">
                        {i.profile ? (
                          <Link
                            href={`/joueur/${i.profile.slug}`}
                            className="truncate font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            {i.profile.pseudo}
                          </Link>
                        ) : (
                          <span className="font-semibold">Joueur inconnu</span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full"
                            style={{ background: crest.nom === "Non classé" ? "var(--color-muted)" : crest.couleur }}
                          />
                          {crest.nom}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-mini text-muted uppercase tabular-nums">
                      {i.seed ? `Seed ${i.seed}` : i.statut}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {estEquipes && agentsEnAttente.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-mini text-muted uppercase tabular-nums">Agents libres · {agentsEnAttente.length}</h3>
              <ul className="flex flex-wrap gap-2">
                {agentsEnAttente.map((a) => (
                  <li key={a.profile_id} className="panneau px-3 py-2 text-sm">
                    {a.profile ? (
                      <Link
                        href={`/joueur/${a.profile.slug}`}
                        className="font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {a.profile.pseudo}
                      </Link>
                    ) : (
                      "Joueur"
                    )}
                    {a.role && ROLES.includes(a.role as Role) && (
                      <span className="text-muted"> · {LABEL_ROLE[a.role as Role]}</span>
                    )}
                    {a.statut === "confirme" && <span className="text-accent"> · présent</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Regroupés en équipes de cinq au lancement du bracket, parmi ceux qui ont confirmé leur présence.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ================= DÉROULEMENT + RÈGLEMENT ================= */}
      <section className="px-gouttiere pt-section-outil pb-24">
        <div className="mx-auto grid max-w-contenu gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-8">
            <Deroulement etapes={etapes} />
            {statut !== "annule" && <CriteresClassement evaluation={classement} />}
          </div>
          <EssentielReglement organisateur={organisateur?.pseudo} condition={condition} equipes={estEquipes} />
        </div>
      </section>
    </main>
  );
}

