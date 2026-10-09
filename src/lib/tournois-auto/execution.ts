// Tournois automatiques — applique en base les actions décidées par
// planification.ts. Appelé uniquement par la tâche planifiée
// /api/cron/tournois-auto (authentifiée par CRON_SECRET), jamais par le
// navigateur : utilise le client service_role.
//
// Chaque étape est rejouable sans effet en double (CLAUDE.md §6.4) :
// - création : adresse (slug) unique par créneau et par jour ;
// - changement de statut : « seulement si le statut est encore X »,
//   donc un seul passage peut le faire ;
// - rappels : on réserve d'abord la ligne (tournoi, type) dans
//   rappels_tournoi, on n'envoie que si la réservation a réussi — un
//   joueur ne reçoit jamais deux fois le même rappel.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { construireBracket, ordonnerParRating } from "@/lib/bracket-construction";
import { envoyerRappel, notifierDiscord, notifierJoueur, URL_SITE } from "@/lib/notifications";
import { boutonCheckin, boutonPret } from "@/lib/suites-joueur";
import { configAncrage, deposerEmpreinte } from "@/lib/ancrage-github";
import { matchsOuverts } from "@/lib/apres-verdict";
import { cloturerTournoi } from "@/lib/classement-actions";
import { verifierCleRiot } from "@/lib/riot";
import {
  capaciteEffective,
  CRENEAUX,
  ajouterJours,
  heureParis,
  jourLisibleParis,
  jourParis,
  nomTournoi,
  slugTournoi,
  trouverCreneau,
} from "./creneaux";
import { planifier, type Action, type TournoiSuivi, type TypeRappel } from "./planification";
import { echapperDiscord } from "@/lib/echappement";
import { doitPublierEmpreinte } from "@/lib/registre";
import { lundiDeLaSemaine, messageRecap } from "@/lib/recap-semaine";
import { chargerRecapSemaine } from "@/lib/recap-semaine-serveur";

export type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

// Si un créneau a été retiré de CRENEAUX alors qu'un de ses tournois
// était déjà créé : même minimum que le créneau d'origine.
const MINIMUM_PAR_DEFAUT = 4;

// game_id=1 est LoL — seule ligne de `games` en V1 (même convention que
// creerTournoi dans lib/tournoi-actions.ts).
const JEU_LOL = 1;

const TYPES_RAPPEL: readonly TypeRappel[] = ["annonce", "checkin_ouvert", "dernier_appel"];

export interface BilanTournoisAuto {
  simulation: boolean;
  actions: Action[];
  resultats: string[];
  erreur?: string;
}

export async function executerTournoisAuto(simulation: boolean): Promise<BilanTournoisAuto> {
  const admin = creerClientAdmin();
  if (!admin) {
    return { simulation, actions: [], resultats: [], erreur: "SUPABASE_SERVICE_ROLE_KEY n'est pas configurée." };
  }

  const maintenant = new Date();
  const tournois = await chargerTournoisSuivis(admin, maintenant);
  if (!tournois) {
    return { simulation, actions: [], resultats: [], erreur: "Lecture des tournois impossible." };
  }

  const actions = planifier(maintenant, tournois, CRENEAUX);
  if (simulation) {
    return { simulation, actions, resultats: [] };
  }

  const resultats: string[] = [];
  // Une action à la fois, dans l'ordre du plan : ouvrir le check-in
  // avant d'envoyer le rappel qui l'annonce.
  for (const action of actions) {
    try {
      resultats.push(await appliquer(admin, action));
    } catch (erreur) {
      resultats.push(`${action.type} : échec (${erreur instanceof Error ? erreur.message : "erreur inconnue"})`);
    }
  }

  try {
    resultats.push(...(await reprendreCloturesEnAttente(admin)));
  } catch (erreur) {
    resultats.push(`reprise des clôtures : échec (${erreur instanceof Error ? erreur.message : "erreur inconnue"})`);
  }

  try {
    resultats.push(...(await surveillerCleRiot(admin, tournois, maintenant)));
  } catch (erreur) {
    resultats.push(`contrôle de la clé Riot : échec (${erreur instanceof Error ? erreur.message : "erreur inconnue"})`);
  }

  try {
    resultats.push(...(await publierEmpreinteRegistre(admin, maintenant)));
  } catch (erreur) {
    resultats.push(`empreinte du registre : échec (${erreur instanceof Error ? erreur.message : "erreur inconnue"})`);
  }

  try {
    resultats.push(...(await ancrerEmpreintesSurGithub(admin)));
  } catch (erreur) {
    resultats.push(`ancrage GitHub : échec (${erreur instanceof Error ? erreur.message : "erreur inconnue"})`);
  }

  try {
    resultats.push(...(await publierRecapSemaine(admin, maintenant)));
  } catch (erreur) {
    resultats.push(`récap de la semaine : échec (${erreur instanceof Error ? erreur.message : "erreur inconnue"})`);
  }

  return { simulation, actions, resultats };
}

// Récap de la semaine (28/09/2026, audit N17) : le lundi à partir de
// 10 h (heure de Paris), la semaine précédente est racontée sur Discord,
// une seule fois (ligne de recaps_semaine) — jamais une semaine vide.
async function publierRecapSemaine(admin: ClientAdmin, maintenant: Date): Promise<string[]> {
  const lundi = lundiDeLaSemaine(maintenant);
  if (jourParis(maintenant) !== lundi || heureParis(maintenant.toISOString()) < "10:00") return [];
  const semaine = ajouterJours(lundi, -7);

  const { data: deja } = await admin.from("recaps_semaine").select("semaine").eq("semaine", semaine).maybeSingle();
  if (deja) return [];

  const { recap, joueurs } = await chargerRecapSemaine(admin, semaine);
  const { data: inseree } = await admin
    .from("recaps_semaine")
    .insert({ semaine, annonce: recap !== null })
    .select("semaine")
    .maybeSingle();
  if (!inseree || !recap) return inseree ? [`récap de la semaine du ${semaine} : semaine vide, rien publié`] : [];

  const nom = (id: string) => {
    const j = joueurs.get(id);
    return j && !j.supprime ? `**${echapperDiscord(j.pseudo)}**` : "un compte supprimé";
  };
  await notifierDiscord(messageRecap(recap, nom, `${URL_SITE}/lol/semaine/${semaine}`));
  return [`récap de la semaine du ${semaine} : publié`];
}

// Empreinte du soir (28/09/2026, audit N8) : la dernière empreinte du
// registre des points est publiée sur Discord, une fois par jour après
// 23 h 45 (heure de Paris) et seulement si le registre a changé. Publiée
// hors de Najarena et datée par Discord, elle permet à n'importe qui de
// prouver plus tard que le registre n'a pas été retouché (page /registre).
async function publierEmpreinteRegistre(admin: ClientAdmin, maintenant: Date): Promise<string[]> {
  const jour = jourParis(maintenant);
  const [{ data: dejaPubliee }, { data: derniere }, { data: precedente }] = await Promise.all([
    admin.from("empreintes_publiees").select("jour").eq("jour", jour).maybeSingle(),
    admin.from("rating_events").select("numero, empreinte").order("numero", { ascending: false }).limit(1).maybeSingle(),
    admin.from("empreintes_publiees").select("numero").order("jour", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (
    !derniere ||
    !doitPublierEmpreinte(heureParis(maintenant.toISOString()), Boolean(dejaPubliee), derniere.numero, precedente?.numero ?? null)
  ) {
    return [];
  }

  // Une seule publication par jour, même si deux passages se chevauchent :
  // la ligne du jour est la clé.
  const { data: inseree } = await admin
    .from("empreintes_publiees")
    .insert({ jour, numero: derniere.numero, empreinte: derniere.empreinte })
    .select("jour")
    .maybeSingle();
  if (!inseree) return [];

  await notifierDiscord(
    `🔏 Registre des points au ${jour.split("-").reverse().join("/")} : ${derniere.numero} ligne${derniere.numero > 1 ? "s" : ""}, dernière empreinte \`${derniere.empreinte}\`. Retoucher une seule ligne passée changerait cette empreinte. Vérifier : ${URL_SITE}/registre`,
  );
  return [`empreinte du registre publiée (${derniere.numero} lignes)`];
}

// Registre ancré sur GitHub (09/10/2026, idée en réserve n°3) : chaque
// empreinte publiée (sur 7 jours) qui n'est pas encore déposée dans le
// dépôt GitHub public l'est — aussitôt après la publication du soir, ou au
// passage suivant si GitHub ne répondait pas. Sans configuration, rien.
async function ancrerEmpreintesSurGithub(admin: ClientAdmin): Promise<string[]> {
  const config = configAncrage();
  if (!config) return [];
  const { data: aDeposer } = await admin
    .from("empreintes_publiees")
    .select("jour, numero, empreinte")
    .is("ancree_github_le", null)
    .gte("jour", ajouterJours(jourParis(new Date()), -7))
    .order("jour", { ascending: true });
  const resultats: string[] = [];
  for (const e of aDeposer ?? []) {
    const issue = await deposerEmpreinte({ jour: e.jour, numero: e.numero, empreinte: e.empreinte, site: URL_SITE }, config);
    if (issue === "depose" || issue === "deja_depose") {
      await admin.from("empreintes_publiees").update({ ancree_github_le: new Date().toISOString() }).eq("jour", e.jour);
    }
    resultats.push(`empreinte du ${e.jour} sur GitHub : ${issue}`);
  }
  return resultats;
}

// Contrôle de la clé Riot dans les heures qui précèdent chaque tournoi
// automatique (28/09/2026, audit E13). La clé de développement expire
// toutes les 24 h : un soir où elle a expiré, aucun résultat n'est lu et
// tout part en litige. L'organisateur est prévenu une fois par tournoi
// (ligne « cle_riot_invalide » de rappels_tournoi). Le tournoi a lieu
// quand même : la recherche des résultats continue 24 h, une clé
// renouvelée dans la soirée les retrouve encore.
const FENETRE_CONTROLE_CLE_HEURES = 6;

async function surveillerCleRiot(
  admin: ClientAdmin,
  tournois: TournoiSuivi[],
  maintenant: Date,
): Promise<string[]> {
  const proches = tournois.filter((t) => {
    if (t.creneau_auto === null || (t.statut !== "ouvert" && t.statut !== "checkin")) return false;
    const avantDebut = new Date(t.debute_le).getTime() - maintenant.getTime();
    return avantDebut > 0 && avantDebut <= FENETRE_CONTROLE_CLE_HEURES * 3_600_000;
  });
  if (proches.length === 0) return [];

  const etat = await verifierCleRiot();
  // « injoignable » : panne réseau passagère, on ne donne pas l'alerte.
  if (etat === "valide" || etat === "injoignable") return [];

  const resultats: string[] = [];
  for (const tournoi of proches) {
    const { error: dejaPrevenu } = await admin
      .from("rappels_tournoi")
      .insert({ tournament_id: tournoi.id, type: "cle_riot_invalide" });
    if (dejaPrevenu) continue;

    const { data: t } = await admin
      .from("tournaments")
      .select("nom, slug, debute_le, organisateur_id")
      .eq("id", tournoi.id)
      .maybeSingle();
    if (!t) continue;

    await notifierJoueur(
      t.organisateur_id,
      `Clé Riot ${etat === "absente" ? "absente" : "expirée"} — ${t.nom}`,
      "La clé de l'API Riot doit être renouvelée",
      `<p>La clé de l'API Riot est ${etat === "absente" ? "absente de la configuration du serveur" : "expirée ou refusée"} : aucun compte ne peut être lié et aucun résultat ne peut être lu automatiquement.</p>
       <p>Renouvelle-la sur developer.riotgames.com, puis remplace RIOT_API_KEY dans les variables d'environnement de Vercel avant ${heureParis(t.debute_le)}.</p>
       <p>Sans nouvelle clé, le tournoi a lieu quand même : ses résultats seront retrouvés dès que la clé sera remplacée (la recherche continue 24 h), ou tranchés à la main.</p>
       <p><a href="${URL_SITE}/lol/tournois/${t.slug}">Voir le tournoi</a></p>`,
    );
    resultats.push(`alerte clé Riot (${etat}) ${t.slug} : envoyée`);
  }
  return resultats;
}

// Tournois (automatiques ou d'organisateur) dont la finale est jouée mais
// qui ne sont pas « terminés » : leur clôture — le calcul Glicko-2 — a
// échoué ou a été interrompue (docs/schema.sql, ETAT_DE_DEPART_PERIME).
// Jusqu'au 28/09/2026, rien ne la relançait : les joueurs restaient sans
// leurs points. Relancer est sans danger, la base refuse tout double crédit.
// Une finale gagnée par forfait automatique (audit N4) est jouée elle aussi.
async function reprendreCloturesEnAttente(admin: ClientAdmin): Promise<string[]> {
  const { data: finales } = await admin
    .from("matches")
    .select("tournament_id, tournament:tournaments!inner(slug, statut)")
    .is("match_suivant_id", null)
    .in("statut", ["termine", "forfait"])
    .eq("tournament.statut", "en_cours");

  const resultats: string[] = [];
  for (const finale of finales ?? []) {
    await cloturerTournoi(finale.tournament_id);
    resultats.push(`clôture reprise ${finale.tournament?.slug ?? finale.tournament_id}`);
  }
  return resultats;
}

async function chargerTournoisSuivis(admin: ClientAdmin, maintenant: Date): Promise<TournoiSuivi[] | null> {
  const colonnes = "id, statut, debute_le, checkin_ouvre_le, creneau_auto";
  // Tournois publiés pas encore commencés (tous organisateurs), plus les
  // tournois automatiques récents quel que soit leur statut — pour savoir
  // lesquels existent déjà et ne jamais les recréer.
  const depuis = new Date(maintenant.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const [publies, automatiques] = await Promise.all([
    admin.from("tournaments").select(colonnes).in("statut", ["ouvert", "checkin"]),
    admin.from("tournaments").select(colonnes).not("creneau_auto", "is", null).gte("debute_le", depuis),
  ]);
  if (publies.error || automatiques.error) return null;

  const parId = new Map([...(publies.data ?? []), ...(automatiques.data ?? [])].map((t) => [t.id, t]));
  const ids = Array.from(parId.keys());

  const { data: rappels } =
    ids.length > 0
      ? await admin.from("rappels_tournoi").select("tournament_id, type").in("tournament_id", ids)
      : { data: [] };

  return Array.from(parId.values()).map((t) => ({
    ...t,
    rappels: (rappels ?? [])
      .filter((r) => r.tournament_id === t.id)
      .map((r) => r.type)
      .filter((type): type is TypeRappel => (TYPES_RAPPEL as readonly string[]).includes(type)),
  }));
}

async function appliquer(admin: ClientAdmin, action: Action): Promise<string> {
  switch (action.type) {
    case "creer":
      return creer(admin, action.creneau, action.jour, action.debuteLe, action.checkinOuvreLe);
    case "ouvrir_checkin": {
      const { data } = await admin
        .from("tournaments")
        .update({ statut: "checkin" })
        .eq("id", action.tournoiId)
        .eq("statut", "ouvert")
        .select("id");
      return `check-in ouvert (${action.tournoiId}) : ${data?.length ? "fait" : "déjà fait"}`;
    }
    case "rappel":
      return rappeler(admin, action.tournoiId, action.rappel);
    case "demarrer":
      return demarrer(admin, action.tournoiId);
    case "annuler_retard":
      return annulerRetard(admin, action.tournoiId);
  }
}

// Organisateur des tournois automatiques : un vrai compte, qui voit ces
// tournois dans son cockpit et tranche les litiges comme pour n'importe
// quel tournoi (CLAUDE.md §3 : en cas de doute, on escalade vers
// l'organisateur). TOURNOIS_AUTO_ORGANISATEUR_ID si elle est définie
// (par exemple un compte « Najarena » dédié), sinon le premier admin.
export async function trouverOrganisateur(admin: ClientAdmin): Promise<string | null> {
  const configure = process.env.TOURNOIS_AUTO_ORGANISATEUR_ID;
  if (configure) return configure;
  const { data } = await admin
    .from("admins")
    .select("profile_id")
    .order("ajoute_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.profile_id ?? null;
}

async function creer(
  admin: ClientAdmin,
  cleCreneau: string,
  jour: string,
  debuteLe: string,
  checkinOuvreLe: string,
): Promise<string> {
  const creneau = trouverCreneau(cleCreneau);
  if (!creneau) return `création ${cleCreneau} : créneau inconnu`;

  const organisateurId = await trouverOrganisateur(admin);
  if (!organisateurId) {
    return "création impossible : aucun organisateur (ajouter un compte à la table admins ou définir TOURNOIS_AUTO_ORGANISATEUR_ID)";
  }

  // Comme creerTournoi : rattaché à la saison courante, sinon la clôture
  // n'écrirait rien au classement.
  const { data: saison } = await admin
    .from("seasons")
    .select("id")
    .eq("game_id", JEU_LOL)
    .eq("est_courante", true)
    .maybeSingle();

  const slug = slugTournoi(creneau, jour);
  const { data, error } = await admin
    .from("tournaments")
    .upsert(
      {
        game_id: JEU_LOL,
        season_id: saison?.id ?? null,
        organisateur_id: organisateurId,
        slug,
        nom: nomTournoi(creneau, jour),
        format: "1v1",
        capacite: creneau.capacite,
        best_of: creneau.bestOf,
        region: creneau.region,
        debute_le: debuteLe,
        checkin_ouvre_le: checkinOuvreLe,
        statut: "ouvert",
        creneau_auto: creneau.cle,
        condition_victoire: creneau.conditionVictoire,
      },
      { onConflict: "slug", ignoreDuplicates: true },
    )
    .select("id");

  if (error) return `création ${slug} : ${error.code === "23505" ? "existe déjà" : "échec"}`;
  return `création ${slug} : ${data?.length ? "fait" : "existe déjà"}`;
}

// Réserve le rappel (tournoi, type). Faux s'il a déjà été envoyé.
async function reserverRappel(admin: ClientAdmin, tournoiId: string, type: TypeRappel): Promise<boolean> {
  const { error } = await admin.from("rappels_tournoi").insert({ tournament_id: tournoiId, type });
  return !error;
}

async function rappeler(admin: ClientAdmin, tournoiId: string, type: TypeRappel): Promise<string> {
  const { data: t } = await admin
    .from("tournaments")
    .select("nom, slug, debute_le, checkin_ouvre_le, capacite, creneau_auto")
    .eq("id", tournoiId)
    .maybeSingle();
  if (!t) return `rappel ${type} (${tournoiId}) : tournoi introuvable`;

  if (!(await reserverRappel(admin, tournoiId, type))) {
    return `rappel ${type} ${t.slug} : déjà envoyé`;
  }

  const lien = `${URL_SITE}/lol/tournois/${t.slug}`;
  const heure = heureParis(t.debute_le);

  if (type === "annonce") {
    const { count } = await admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournoiId)
      .neq("statut", "retire");
    // Le nombre d'inscrits n'est annoncé publiquement qu'une fois le
    // minimum atteint : « 0/16 inscrits » chaque jour sur le salon affiche
    // le vide plutôt qu'une invitation (audit du 27/09/2026, M13).
    const minimum = trouverCreneau(t.creneau_auto)?.minimumJoueurs ?? MINIMUM_PAR_DEFAUT;
    const inscrits = count ?? 0;
    const affluence = inscrits >= minimum ? `, ${inscrits}/${t.capacite} inscrits` : "";
    await notifierDiscord(
      `📣 Aujourd'hui à ${heure} : **${echapperDiscord(t.nom)}** — tournoi 1v1 ouvert à tous${affluence}. Inscriptions jusqu'à ${heureParis(t.checkin_ouvre_le)}.\n${lien}`,
    );
    return `annonce ${t.slug} : envoyée`;
  }

  // Les deux rappels ne visent que les joueurs qui n'ont pas encore fait
  // leur check-in.
  const { data: aRappeler } = await admin
    .from("registrations")
    .select("profile_id")
    .eq("tournament_id", tournoiId)
    .eq("statut", "inscrit");
  const joueurs = (aRappeler ?? []).map((r) => r.profile_id);

  if (type === "checkin_ouvert") {
    await Promise.all(
      joueurs.map((id) =>
        envoyerRappel(
          id,
          `Check-in ouvert — ${t.nom}`,
          `Confirme ta présence avant ${heure} : seuls les joueurs confirmés sont placés dans le bracket.`,
          lien,
          { boutons: [boutonCheckin(tournoiId)] },
        ),
      ),
    );
    await notifierDiscord(`✅ Check-in ouvert : **${echapperDiscord(t.nom)}** commence à ${heure}. Inscrits, confirmez votre présence.\n${lien}`);
  } else {
    await Promise.all(
      joueurs.map((id) =>
        envoyerRappel(
          id,
          `Dernier appel — ${t.nom}`,
          `Le tournoi commence à ${heure} et ton check-in n'est pas fait. Sans lui, pas de place dans le bracket.`,
          lien,
          { boutons: [boutonCheckin(tournoiId)] },
        ),
      ),
    );
  }

  return `rappel ${type} ${t.slug} : ${joueurs.length} joueur(s)`;
}

async function demarrer(admin: ClientAdmin, tournoiId: string): Promise<string> {
  const { data: t } = await admin
    .from("tournaments")
    .select("id, nom, slug, capacite, creneau_auto, organisateur_id")
    .eq("id", tournoiId)
    .maybeSingle();
  if (!t) return `démarrage (${tournoiId}) : tournoi introuvable`;

  // Verrou d'abord : une fois « en cours », plus aucun check-in n'est
  // accepté (lib/checkin-actions.ts) — la liste des confirmés lue juste
  // après est donc définitive. Un seul passage peut prendre ce verrou.
  const { data: pris } = await admin
    .from("tournaments")
    .update({ statut: "en_cours" })
    .eq("id", tournoiId)
    .in("statut", ["ouvert", "checkin"])
    .select("id");
  if (!pris?.length) return `démarrage ${t.slug} : déjà traité`;

  const { data: inscriptions } = await admin
    .from("registrations")
    .select("profile_id, statut, inscrit_le, confirme_le, rating_a_inscription")
    .eq("tournament_id", tournoiId);

  // Premiers arrivés, premiers servis : si le bracket est plein, les
  // premiers à avoir fait leur check-in sont retenus.
  const confirmes = (inscriptions ?? [])
    .filter((i) => i.statut === "confirme")
    .sort((a, b) => (a.confirme_le ?? a.inscrit_le).localeCompare(b.confirme_le ?? b.inscrit_le));

  const creneau = trouverCreneau(t.creneau_auto);
  const minimum = creneau?.minimumJoueurs ?? MINIMUM_PAR_DEFAUT;
  const lien = `${URL_SITE}/lol/tournois/${t.slug}`;

  if (confirmes.length < minimum) {
    await admin.from("tournaments").update({ statut: "annule" }).eq("id", tournoiId);

    const prochain = creneau ? ` Prochain tournoi : demain à ${creneau.heure}.` : "";
    await Promise.all(
      (inscriptions ?? [])
        .filter((i) => i.statut === "inscrit" || i.statut === "confirme")
        .map((i) =>
          envoyerRappel(
            i.profile_id,
            `Tournoi annulé — ${t.nom}`,
            `Pas assez de joueurs confirmés (${confirmes.length} sur ${minimum} minimum).${prochain}`,
            lien,
          ),
        ),
    );
    // Pas d'annonce publique d'une annulation faute de joueurs (audit du
    // 27/09/2026, M13) : un message quotidien « annulé — 0 joueur » sur le
    // salon est le signal le plus décourageant possible pour un nouveau
    // venu. Seuls les inscrits sont prévenus, en privé (ci-dessus).
    return `démarrage ${t.slug} : annulé (${confirmes.length}/${minimum} confirmés)`;
  }

  // Garde-fou : jamais deux brackets pour un même tournoi.
  const { count: nbMatchs } = await admin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournoiId);
  if (nbMatchs && nbMatchs > 0) return `démarrage ${t.slug} : bracket déjà présent`;

  // Check-in non fait à l'heure du début : absent.
  await admin
    .from("registrations")
    .update({ statut: "absent" })
    .eq("tournament_id", tournoiId)
    .eq("statut", "inscrit");

  // Les premiers à avoir fait leur check-in ont leur place ; parmi eux, les
  // têtes de série suivent le rating à l'inscription.
  const retenus = ordonnerParRating(
    confirmes.slice(0, t.capacite).map((c) => ({ profileId: c.profile_id, rating: c.rating_a_inscription })),
  );
  const surplus = confirmes.slice(t.capacite).map((c) => c.profile_id);

  // Bracket à la taille des présents (voir capaciteEffective).
  const capacite = capaciteEffective(retenus.length, t.capacite);
  if (capacite !== t.capacite) {
    await admin.from("tournaments").update({ capacite }).eq("id", tournoiId);
  }

  let byesEchoues = 0;
  const { ok } = await construireBracket(admin, tournoiId, capacite, retenus, async (matchId, gagnantId) => {
    const { error } = await admin.rpc("enregistrer_bye_automatique", {
      p_match_id: matchId,
      p_gagnant_id: gagnantId,
    });
    if (error) byesEchoues += 1;
  });

  if (!ok || byesEchoues > 0) {
    // Jamais de résultat inventé pour réparer : l'organisateur termine
    // le bracket à la main depuis son cockpit.
    await envoyerRappel(
      t.organisateur_id,
      `Démarrage automatique incomplet — ${t.nom}`,
      "Le bracket n'a pas pu être généré entièrement. Ouvre le cockpit du tournoi pour le terminer.",
      `${URL_SITE}/moi/organisation/${tournoiId}`,
    );
  }

  // Bouton « Je suis prêt » à ceux dont le match du premier tour est ouvert.
  const matchDe = new Map((await matchsOuverts(tournoiId)).flatMap((m) => m.joueurs.map((j) => [j, m.matchId] as const)));
  await Promise.all([
    ...retenus.map((id) => {
      const matchId = matchDe.get(id);
      return envoyerRappel(
        id,
        `C'est parti — ${t.nom}`,
        "Le bracket est en ligne. Ouvre-le pour voir ton adversaire et lancer ta partie.",
        matchId ? `${lien}#ton-match` : lien,
        { boutons: matchId ? [boutonPret(matchId)] : [] },
      );
    }),
    ...surplus.map((id) =>
      envoyerRappel(
        id,
        `Tournoi complet — ${t.nom}`,
        `Le bracket était plein (${t.capacite} places) : les premiers à faire leur check-in ont été retenus.`,
        lien,
      ),
    ),
  ]);
  await notifierDiscord(`⚔️ **${echapperDiscord(t.nom)}** commence — ${retenus.length} joueurs.\n${lien}`);

  return `démarrage ${t.slug} : ${retenus.length} joueurs, bracket de ${capacite}${
    ok && byesEchoues === 0 ? "" : " (INCOMPLET — organisateur prévenu)"
  }`;
}

async function annulerRetard(admin: ClientAdmin, tournoiId: string): Promise<string> {
  const { data: t } = await admin
    .from("tournaments")
    .select("nom, slug, debute_le, creneau_auto, organisateur_id")
    .eq("id", tournoiId)
    .maybeSingle();
  if (!t) return `annulation (${tournoiId}) : tournoi introuvable`;
  const automatique = t.creneau_auto !== null;

  const { data: annule } = await admin
    .from("tournaments")
    .update({ statut: "annule" })
    .eq("id", tournoiId)
    .in("statut", ["ouvert", "checkin"])
    .select("id");
  if (!annule?.length) return `annulation ${t.slug} : déjà traité`;

  const { data: inscriptions } = await admin
    .from("registrations")
    .select("profile_id")
    .eq("tournament_id", tournoiId)
    .in("statut", ["inscrit", "confirme"]);

  const texte = automatique
    ? `Le tournoi du ${jourLisibleParis(t.debute_le)} n'a pas pu démarrer à l'heure (incident technique) : il est annulé.`
    : `Le tournoi du ${jourLisibleParis(t.debute_le)} n'a pas été lancé par son organisateur dans les 2 heures suivant l'heure prévue : il est annulé.`;
  await Promise.all(
    (inscriptions ?? []).map((i) =>
      envoyerRappel(i.profile_id, `Tournoi annulé — ${t.nom}`, texte, `${URL_SITE}/lol/tournois/${t.slug}`),
    ),
  );
  if (automatique) {
    await notifierDiscord(`❌ **${echapperDiscord(t.nom)}** annulé — incident technique au démarrage.`);
  } else {
    await envoyerRappel(
      t.organisateur_id,
      `Tournoi annulé automatiquement — ${t.nom}`,
      "Ton tournoi n'a pas été lancé dans les 2 heures suivant l'heure prévue : il a été annulé et les inscrits ont été prévenus.",
      `${URL_SITE}/moi/organisation/${tournoiId}`,
    );
  }
  return `annulation ${t.slug} : faite (${automatique ? "démarrage manqué" : "jamais lancé par l'organisateur"})`;
}
