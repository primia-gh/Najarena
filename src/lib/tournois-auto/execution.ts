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
import { construireBracket, melanger } from "@/lib/bracket-construction";
import { envoyerRappel, notifierDiscord, URL_SITE } from "@/lib/notifications";
import {
  capaciteEffective,
  CRENEAUX,
  heureParis,
  jourLisibleParis,
  nomTournoi,
  slugTournoi,
  trouverCreneau,
} from "./creneaux";
import { planifier, type Action, type TournoiSuivi, type TypeRappel } from "./planification";

type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

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

  return { simulation, actions, resultats };
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
async function trouverOrganisateur(admin: ClientAdmin): Promise<string | null> {
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
    .select("nom, slug, debute_le, checkin_ouvre_le, capacite")
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
    await notifierDiscord(
      `📣 Aujourd'hui à ${heure} : **${t.nom}** — tournoi 1v1 ouvert à tous, ${count ?? 0}/${t.capacite} inscrits. Inscriptions jusqu'à ${heureParis(t.checkin_ouvre_le)}.\n${lien}`,
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
        ),
      ),
    );
    await notifierDiscord(`✅ Check-in ouvert : **${t.nom}** commence à ${heure}. Inscrits, confirmez votre présence.\n${lien}`);
  } else {
    await Promise.all(
      joueurs.map((id) =>
        envoyerRappel(
          id,
          `Dernier appel — ${t.nom}`,
          `Le tournoi commence à ${heure} et ton check-in n'est pas fait. Sans lui, pas de place dans le bracket.`,
          lien,
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
    .select("profile_id, statut, inscrit_le, confirme_le")
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
    await notifierDiscord(
      `❌ **${t.nom}** annulé — ${confirmes.length} joueur(s) confirmé(s), ${minimum} minimum.${prochain}`,
    );
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

  const retenus = confirmes.slice(0, t.capacite).map((c) => c.profile_id);
  const surplus = confirmes.slice(t.capacite).map((c) => c.profile_id);

  // Bracket à la taille des présents (voir capaciteEffective).
  const capacite = capaciteEffective(retenus.length, t.capacite);
  if (capacite !== t.capacite) {
    await admin.from("tournaments").update({ capacite }).eq("id", tournoiId);
  }

  let byesEchoues = 0;
  const { ok } = await construireBracket(admin, tournoiId, capacite, melanger(retenus), async (matchId, gagnantId) => {
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

  await Promise.all([
    ...retenus.map((id) =>
      envoyerRappel(
        id,
        `C'est parti — ${t.nom}`,
        "Le bracket est en ligne. Ouvre-le pour voir ton adversaire et lancer ta partie.",
        lien,
      ),
    ),
    ...surplus.map((id) =>
      envoyerRappel(
        id,
        `Tournoi complet — ${t.nom}`,
        `Le bracket était plein (${t.capacite} places) : les premiers à faire leur check-in ont été retenus.`,
        lien,
      ),
    ),
  ]);
  await notifierDiscord(`⚔️ **${t.nom}** commence — ${retenus.length} joueurs.\n${lien}`);

  return `démarrage ${t.slug} : ${retenus.length} joueurs, bracket de ${capacite}${
    ok && byesEchoues === 0 ? "" : " (INCOMPLET — organisateur prévenu)"
  }`;
}

async function annulerRetard(admin: ClientAdmin, tournoiId: string): Promise<string> {
  const { data: t } = await admin.from("tournaments").select("nom, slug, debute_le").eq("id", tournoiId).maybeSingle();
  if (!t) return `annulation (${tournoiId}) : tournoi introuvable`;

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

  const texte = `Le tournoi du ${jourLisibleParis(t.debute_le)} n'a pas pu démarrer à l'heure (incident technique) : il est annulé.`;
  await Promise.all(
    (inscriptions ?? []).map((i) =>
      envoyerRappel(i.profile_id, `Tournoi annulé — ${t.nom}`, texte, `${URL_SITE}/lol/tournois/${t.slug}`),
    ),
  );
  await notifierDiscord(`❌ **${t.nom}** annulé — incident technique au démarrage.`);
  return `annulation ${t.slug} : faite (démarrage manqué)`;
}
