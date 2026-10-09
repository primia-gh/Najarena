// Divisions mensuelles (09/10/2026, idée en réserve n°13), côté serveur :
// à chaque passage de la tâche des tournois automatiques (toutes les 5
// minutes), (1) forme les poules des ligues dont le premier lundi est
// arrivé, (2) annonce aux joueurs leur match de la semaine, (3) clôt les
// ligues finies depuis 24 h (le temps de lire les derniers duels) avec
// montées et descentes. Calculs : lib/divisions.ts ; règles : la base.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import {
  classementPoule,
  LIBELLE_MOUVEMENT,
  mouvementDe,
  repartirPoules,
  semaineLigue,
  SEMAINES_LIGUE,
  type Mouvement,
} from "@/lib/divisions";

type ClientAdmin = NonNullable<ReturnType<typeof creerClientAdmin>>;

const lienLigue = (region: string) => `${URL_SITE}/lol/divisions?region=${encodeURIComponent(region)}#ma-poule`;

async function pseudos(admin: ClientAdmin, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.from("profiles").select("id, pseudo").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.pseudo]));
}

async function formerPoules(admin: ClientAdmin, maintenant: Date): Promise<string[]> {
  const { data: ligues } = await admin
    .from("ligues_division")
    .select("id, region, debut_le")
    .eq("statut", "inscriptions")
    .lte("debut_le", maintenant.toISOString());
  const resultats: string[] = [];

  for (const ligue of ligues ?? []) {
    const [{ data: inscriptions }, { data: saison }, { data: precedente }] = await Promise.all([
      admin.from("inscriptions_division").select("profile_id, inscrit_le").eq("ligue_id", ligue.id),
      admin.from("seasons").select("id").eq("game_id", 1).eq("est_courante", true).maybeSingle(),
      admin
        .from("ligues_division")
        .select("id")
        .eq("region", ligue.region)
        .eq("statut", "terminee")
        .lt("debut_le", ligue.debut_le)
        .order("debut_le", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const ids = (inscriptions ?? []).map((i) => i.profile_id);
    const [{ data: ratings }, { data: anciens }] = await Promise.all([
      saison && ids.length
        ? admin.from("ratings").select("profile_id, rating").eq("game_id", 1).eq("season_id", saison.id).in("profile_id", ids)
        : Promise.resolve({ data: [] as { profile_id: string; rating: number }[] }),
      precedente
        ? admin
            .from("membres_poule_division")
            .select("profile_id, rang_final, mouvement, poule:poules_division!inner(niveau, ligue_id)")
            .eq("poule.ligue_id", precedente.id)
        : Promise.resolve({ data: [] }),
    ]);
    const rating = new Map((ratings ?? []).map((r) => [r.profile_id, Number(r.rating)]));
    const { poules, enAttente } = repartirPoules(
      (inscriptions ?? []).map((i) => ({ id: i.profile_id, rating: rating.get(i.profile_id) ?? null, inscritLe: i.inscrit_le })),
      (anciens ?? []).flatMap((a) =>
        a.poule && a.rang_final
          ? [{ id: a.profile_id, niveau: a.poule.niveau, rang: a.rang_final, mouvement: (a.mouvement as Mouvement | null) ?? null }]
          : [],
      ),
    );

    const { error } = await admin.rpc("former_poules_division", { p_ligue_id: ligue.id, p_poules: poules });
    if (error) {
      resultats.push(`division ${ligue.region} : formation impossible (${error.message})`);
      continue;
    }
    const lien = lienLigue(ligue.region);
    await Promise.all([
      ...poules.flatMap((poule, i) =>
        poule.map((id) =>
          envoyerRappel(
            id,
            "Ta poule de division est prête",
            `Poule ${i + 1}, ${poule.length - 1} adversaires : un match par semaine contre chacun. Mettez-vous d'accord sur l'heure, puis cliquez tous les deux « Je suis là ».`,
            lien,
          ),
        ),
      ),
      ...(poules.length === 0 ? ids : enAttente).map((id) =>
        envoyerRappel(
          id,
          poules.length === 0 ? "Ligue annulée" : "Pas de place dans la ligue ce mois-ci",
          poules.length === 0
            ? "Trop peu d'inscrits dans ta région pour former une poule ce mois-ci. Réinscris-toi pour le mois prochain."
            : "Les poules se font par 3 ou 4 : en dernier inscrit, tu attends le mois prochain. Réinscris-toi dès maintenant.",
          `${URL_SITE}/lol/divisions`,
        ),
      ),
    ]);
    resultats.push(`division ${ligue.region} : ${poules.length} poule(s), ${enAttente.length} en attente`);
  }
  return resultats;
}

async function annoncerSemaine(admin: ClientAdmin, maintenant: Date): Promise<string[]> {
  const { data: ligues } = await admin
    .from("ligues_division")
    .select("id, region, debut_le, semaine_annoncee")
    .eq("statut", "en_cours");
  const resultats: string[] = [];

  for (const ligue of ligues ?? []) {
    const semaine = semaineLigue(ligue.debut_le, maintenant);
    if (semaine < 1 || semaine > SEMAINES_LIGUE || semaine <= ligue.semaine_annoncee) continue;
    const { data: rencontres } = await admin.rpc("rencontres_ligue", { p_ligue_id: ligue.id });
    // Semaines 1 à 3 : le match de la semaine ; semaine 4 : ce qui reste à jouer.
    const aAnnoncer = (rencontres ?? []).filter((r) =>
      semaine <= 3 ? r.semaine === semaine : !r.gagnant_id && r.tournoi_statut !== "en_cours",
    );
    const noms = await pseudos(admin, [...new Set(aAnnoncer.flatMap((r) => [r.joueur_a, r.joueur_b]))]);
    const lien = lienLigue(ligue.region);
    await Promise.all(
      aAnnoncer.flatMap((r) =>
        [
          [r.joueur_a, r.joueur_b],
          [r.joueur_b, r.joueur_a],
        ].map(([moi, adversaire]) =>
          envoyerRappel(
            moi,
            semaine <= 3 ? `Division, semaine ${semaine}` : "Division : semaine de rattrapage",
            semaine <= 3
              ? `Ton match de la semaine : contre ${noms.get(adversaire) ?? "ton adversaire"}. Mettez-vous d'accord sur l'heure, puis cliquez tous les deux « Je suis là ».`
              : `Ton match contre ${noms.get(adversaire) ?? "ton adversaire"} n'est pas encore joué : dernière semaine pour le jouer.`,
            lien,
          ),
        ),
      ),
    );
    await admin.from("ligues_division").update({ semaine_annoncee: semaine }).eq("id", ligue.id);
    resultats.push(`division ${ligue.region} : semaine ${semaine} annoncée (${aAnnoncer.length} match(s))`);
  }
  return resultats;
}

async function cloturerLigues(admin: ClientAdmin, maintenant: Date): Promise<string[]> {
  const veille = new Date(maintenant.getTime() - 86_400_000).toISOString();
  const { data: ligues } = await admin
    .from("ligues_division")
    .select("id, region")
    .eq("statut", "en_cours")
    .lte("fin_le", veille);
  const resultats: string[] = [];

  for (const ligue of ligues ?? []) {
    const [{ data: poules }, { data: rencontres }] = await Promise.all([
      admin
        .from("poules_division")
        .select("id, niveau, membres_poule_division(profile_id, ordre)")
        .eq("ligue_id", ligue.id)
        .order("niveau", { ascending: true }),
      admin.rpc("rencontres_ligue", { p_ligue_id: ligue.id }),
    ]);
    const nbPoules = (poules ?? []).length;
    const classements = (poules ?? []).flatMap((p) => {
      const lignes = classementPoule(
        p.membres_poule_division.map((m) => ({ id: m.profile_id, ordre: m.ordre })),
        (rencontres ?? [])
          .filter((r) => r.poule_id === p.id)
          .map((r) => ({ joueurA: r.joueur_a, joueurB: r.joueur_b, gagnantId: r.gagnant_id, niveauVerdict: r.niveau_verdict })),
      );
      return lignes.map((l, i) => ({
        joueur: l.id,
        poule: p.id,
        niveau: p.niveau,
        rang: i + 1,
        mouvement: mouvementDe(i + 1, lignes.length, p.niveau, nbPoules),
      }));
    });
    const { error } = await admin.rpc("cloturer_ligue_division", {
      p_ligue_id: ligue.id,
      p_classements: classements.map(({ joueur, poule, rang, mouvement }) => ({ joueur, poule, rang, mouvement })),
    });
    if (error) {
      resultats.push(`division ${ligue.region} : clôture impossible (${error.message})`);
      continue;
    }
    await Promise.all(
      classements.map((c) =>
        envoyerRappel(
          c.joueur,
          "Ta ligue de division est terminée",
          `${c.rang === 1 ? "1er" : `${c.rang}e`} de la poule ${c.niveau} — ${LIBELLE_MOUVEMENT[c.mouvement].toLowerCase()}${
            c.mouvement === "reste" ? " dans ta division" : ""
          }. Inscris-toi à la ligue du mois prochain pour garder ta place.`,
          `${URL_SITE}/lol/divisions`,
        ),
      ),
    );
    resultats.push(`division ${ligue.region} : clôturée (${classements.length} joueurs)`);
  }
  return resultats;
}

/** Bilan du passage, ou null si la base n'est pas joignable. */
export async function executerDivisions(maintenant = new Date()): Promise<string[] | null> {
  const admin = creerClientAdmin();
  if (!admin) return null;
  return [
    ...(await formerPoules(admin, maintenant)),
    ...(await annoncerSemaine(admin, maintenant)),
    ...(await cloturerLigues(admin, maintenant)),
  ];
}
