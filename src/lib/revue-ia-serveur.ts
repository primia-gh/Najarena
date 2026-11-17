import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { chargerMoyennes } from "@/lib/revue-match";
import { demanderJson, iaDisponible, MODELE_IA } from "@/lib/claude";
import { construireDemandeRevue, SCHEMA_REVUE, validerRevue } from "@/lib/revue-ia";

// Revue de match détaillée rédigée par l'IA (audit N25), côté serveur : à la
// demande (bouton du CV, src/lib/revue-ia-actions.ts) ou automatiquement
// après chaque partie vérifiée d'un joueur Elite (tâche de recherche des
// résultats). Client du serveur (service) : il écrit dans revues_match_ia,
// qu'aucun joueur ne peut écrire lui-même.

type ClientServeur = SupabaseClient<Database>;

export type IssueRevue = "ok" | "sans-stats" | "indisponible" | "refus" | "invalide";

/** Revues rédigées à chaque passage de la tâche : la durée de la tâche reste bornée. */
export const REVUES_PAR_PASSAGE = 2;
export const DELAI_APPEL_MS = 20_000;

export async function redigerRevue(
  admin: ClientServeur,
  matchId: string,
  profileId: string,
  delaiMs?: number,
): Promise<IssueRevue> {
  const [{ data: stats }, { data: match }] = await Promise.all([
    admin
      .from("stats_match_joueur")
      .select("profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne")
      .eq("match_id", matchId),
    admin.from("matches").select("tournament:tournaments(format)").eq("id", matchId).maybeSingle(),
  ]);
  const mesStats = stats?.find((s) => s.profile_id === profileId);
  if (!mesStats) return "sans-stats";

  const format = match?.tournament?.format ?? "1v1";
  const enStats = (s: NonNullable<typeof stats>[number]) => ({
    champion: s.champion,
    kills: s.kills,
    deaths: s.deaths,
    assists: s.assists,
    cs: s.cs,
    orGagne: s.or_gagne,
    dureeSecondes: s.duree_secondes,
    gagne: s.gagne,
  });
  // En 1v1, l'adversaire est l'autre joueur ; en 5v5, pas de vis-à-vis unique.
  const adversaire = format === "1v1" ? stats?.find((s) => s.profile_id !== profileId) : undefined;
  const moyennes = await chargerMoyennes(admin, profileId);

  const resultat = await demanderJson({
    ...construireDemandeRevue({
      format,
      moi: enStats(mesStats),
      adversaire: adversaire ? enStats(adversaire) : null,
      moyennesVictoires: moyennes.victoires,
      moyennesDefaites: moyennes.defaites,
    }),
    schema: SCHEMA_REVUE,
    valider: validerRevue,
    delaiMs,
  });
  if (!resultat.ok) return resultat.raison;

  const { error } = await admin.from("revues_match_ia").insert({
    match_id: matchId,
    profile_id: profileId,
    points: resultat.valeur.points,
    conseil: resultat.valeur.conseil,
    modele: MODELE_IA,
  });
  // Doublon (bouton et tâche au même moment) : la revue existe, c'est réussi.
  return !error || error.code === "23505" ? "ok" : "indisponible";
}

/**
 * Parcours des revues à rédiger, une à une : aucune n'est commencée si
 * elle risque de finir après `limite` (heure, en ms) ; l'IA injoignable
 * arrête le passage ; une réponse refusée ou invalide est notée (retentée
 * une seule fois). Fonctions passées en paramètre : testé sans réseau.
 */
export async function parcourirRevues(
  aRediger: { match_id: string; profile_id: string }[],
  rediger: (matchId: string, profileId: string) => Promise<IssueRevue>,
  noterEchec: (matchId: string, profileId: string) => Promise<unknown>,
  limite: number,
  maintenant: () => number = Date.now,
): Promise<{ redigees: number; echecs: number }> {
  const bilan = { redigees: 0, echecs: 0 };
  for (const { match_id, profile_id } of aRediger) {
    if (maintenant() + DELAI_APPEL_MS > limite) break;
    const issue = await rediger(match_id, profile_id);
    if (issue === "ok") {
      bilan.redigees += 1;
      continue;
    }
    bilan.echecs += 1;
    if (issue === "indisponible") break;
    await noterEchec(match_id, profile_id);
  }
  return bilan;
}

/**
 * Revues automatiques (offre Elite) : la base choisit les parties vérifiées
 * récentes à analyser (revues_a_rediger : 10 par joueur et par 24 h au
 * plus), quelques-unes à chaque passage de la tâche.
 */
export async function redigerRevuesAutomatiques(
  admin: ClientServeur,
  limite: number,
): Promise<{ redigees: number; echecs: number }> {
  if (!iaDisponible()) return { redigees: 0, echecs: 0 };
  const { data: aRediger } = await admin.rpc("revues_a_rediger", { p_limite: REVUES_PAR_PASSAGE });
  return parcourirRevues(
    aRediger ?? [],
    (matchId, profileId) => redigerRevue(admin, matchId, profileId, DELAI_APPEL_MS),
    async (matchId, profileId) => {
      await admin.rpc("noter_echec_revue", { p_match_id: matchId, p_profile_id: profileId });
    },
    limite,
  );
}
