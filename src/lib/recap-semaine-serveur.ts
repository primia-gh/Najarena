import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { bornesSemaine, construireRecap, type RecapSemaine } from "@/lib/recap-semaine";

// Chargement du récap d'une semaine (audit N17), pour la page publique
// (client anonyme) comme pour la publication du lundi (client serveur).

type Client = SupabaseClient<Database>;

export interface DonneesRecapSemaine {
  recap: RecapSemaine | null;
  joueurs: Map<string, { pseudo: string; slug: string; supprime: boolean }>;
  tournois: Map<string, { nom: string; slug: string }>;
}

export async function chargerRecapSemaine(client: Client, lundi: string): Promise<DonneesRecapSemaine> {
  const { debut, fin } = bornesSemaine(lundi);
  const [{ data: variations }, { data: paliersData }] = await Promise.all([
    client
      .from("rating_events")
      .select("profile_id, tournament_id, rating_avant, rd_avant, rating_apres, rd_apres, cree_le")
      .eq("motif", "tournoi")
      .gte("cree_le", debut.toISOString())
      .lt("cree_le", fin.toISOString())
      .limit(5000),
    client.from("tiers").select("nom, rating_min").eq("game_id", 1),
  ]);

  const lignes = (variations ?? []).filter((v) => v.tournament_id !== null);
  const idsTournois = [...new Set(lignes.map((v) => v.tournament_id as string))];
  const [{ data: matchs }, { data: tournoisData }] =
    idsTournois.length > 0
      ? await Promise.all([
          client
            .from("matches")
            .select("tournament_id, match_participants(profile_id), match_verdicts(niveau, gagnant_id, est_definitif)")
            .in("tournament_id", idsTournois),
          client.from("tournaments").select("id, nom, slug").in("id", idsTournois),
        ])
      : [{ data: [] }, { data: [] }];

  const matchsVerifies = (matchs ?? []).flatMap((m) => {
    const verdict = m.match_verdicts.find((v) => v.est_definitif && v.niveau !== "manuel");
    return verdict?.gagnant_id && m.match_participants.length === 2
      ? [{ tournoiId: m.tournament_id, joueurs: m.match_participants.map((p) => p.profile_id), gagnantId: verdict.gagnant_id }]
      : [];
  });

  const recap = construireRecap(
    lignes.map((v) => ({
      profileId: v.profile_id,
      tournoiId: v.tournament_id as string,
      avant: v.rating_avant,
      rdAvant: v.rd_avant,
      apres: v.rating_apres,
      rdApres: v.rd_apres,
      le: v.cree_le,
    })),
    matchsVerifies,
    (paliersData ?? []).map((p) => ({ nom: p.nom, ratingMin: p.rating_min })),
  );

  const ids = recap
    ? [
        ...new Set([
          ...recap.progressions.map((p) => p.profileId),
          ...recap.nouveauxPaliers.map((p) => p.profileId),
          ...recap.actifs.map((p) => p.profileId),
          ...(recap.exploit ? [recap.exploit.gagnantId, recap.exploit.perdantId] : []),
        ]),
      ]
    : [];
  const { data: profils } =
    ids.length > 0 ? await client.from("profiles").select("id, pseudo, slug, supprime_le").in("id", ids) : { data: [] };

  return {
    recap,
    joueurs: new Map((profils ?? []).map((p) => [p.id, { pseudo: p.pseudo, slug: p.slug, supprime: p.supprime_le !== null }])),
    tournois: new Map((tournoisData ?? []).map((t) => [t.id, { nom: t.nom, slug: t.slug }])),
  };
}
