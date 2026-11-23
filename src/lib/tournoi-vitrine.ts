import { createClient } from "@/lib/supabase/server";
import { CRENEAU_A_LA_DEMANDE, estOfficiel } from "@/lib/a-la-demande";
import { libelleNiveau } from "@/lib/niveau-tournoi";
import { NIVEAU_COMPTE_RIOT_MIN } from "@/lib/niveau-compte-riot";

// Données d'affichage ajoutées par la refonte « Venin » de la page tournoi
// (design-system/najarena/pages/tournoi.md) : type de bracket, niveau
// requis, prise en compte au classement. Simple lecture de colonnes de
// `tournaments`, rangée ici pour laisser intact le chargement d'origine de
// lol/tournois/[slug]/page.tsx (chargerTournoi : inscriptions, matchs,
// verdicts, litiges).

const LABEL_BRACKET: Record<string, string> = {
  elim_simple: "Élimination directe",
  suisse: "Format suisse",
  double_elim: "Double élimination",
};

export async function chargerComplementsTournoi(tournoiId: string) {
  const supabase = await createClient();
  const [{ data }, { data: lancementReel }, { count: matchsHorsNiveau }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("type_bracket, rating_min, rating_max, compte_pour_classement, creneau_auto, publie_le, classe, reserve_non_classes")
      .eq("id", tournoiId)
      .maybeSingle(),
    // Lancement réel : passage « en cours », premier match démarré ou
    // premier verdict, le plus tôt (même calcul que criteres_tournoi_classe).
    supabase.rpc("lancement_reel_tournoi", { p_tournament_id: tournoiId }),
    // Matchs lus chez Riot dont un compte était sous le niveau 30
    // (22/11/2026) : vérifiés, mais hors classement.
    supabase
      .from("match_verdicts")
      .select("match_id, match:matches!inner(tournament_id)", { count: "exact", head: true })
      .eq("match.tournament_id", tournoiId)
      .eq("est_definitif", true)
      .lt("niveau_compte_min", NIVEAU_COMPTE_RIOT_MIN),
  ]);

  const min = data?.rating_min ?? null;
  const max = data?.rating_max ?? null;
  // Tournoi par niveau (19/11/2026) : nommé par ses paliers.
  const niveau = data?.reserve_non_classes ? "Joueurs non classés" : (libelleNiveau(min, max) ?? "Ouvert à tous");

  return {
    typeBracket: data ? (LABEL_BRACKET[data.type_bracket] ?? data.type_bracket) : null,
    niveau,
    comptePourClassement: data?.compte_pour_classement ?? true,
    // Tournoi quotidien créé automatiquement (lib/tournois-auto/) ; un
    // tournoi à la demande (idée en réserve n°11) n'est pas « officiel ».
    estQuotidien: estOfficiel(data?.creneau_auto ?? null),
    estALaDemande: data?.creneau_auto === CRENEAU_A_LA_DEMANDE,
    // Tournoi classé (audit N12) : date de publication et décision figée
    // à la clôture (lib/tournoi-classe.ts).
    publieLe: data?.publie_le ?? null,
    // Lancement réel (22/11/2026) : la règle des 24 h compte jusqu'à lui
    // s'il a eu lieu avant la date annoncée.
    lanceLe: lancementReel ?? null,
    classe: data?.classe ?? null,
    matchsHorsNiveau: matchsHorsNiveau ?? 0,
  };
}
