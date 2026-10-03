// Synchronisation du calendrier Clash (03/10/2026, audit N24) : lu dans
// l'API Riot (clash-v1) par le serveur, jamais depuis le navigateur.
// Appelée par la tâche des tournois automatiques, quatre fois par jour.

import { creerClientAdmin } from "@/lib/supabase/admin";
import { REGIONS, recupererTournoisClash } from "@/lib/riot";
import { echeancesDepuisClash } from "@/lib/echeances";

export { doitSynchroniserClash } from "@/lib/echeances";

// Régions synchronisées : celles des tournois Najarena récents, EUW au
// minimum (l'essentiel des joueurs francophones).
const REGION_PAR_DEFAUT = "EUW";

export async function synchroniserClash(
  maintenant = new Date(),
): Promise<{ regions: number; echeances: number } | null> {
  const admin = creerClientAdmin();
  if (!admin) return null;

  const { data: recents } = await admin
    .from("tournaments")
    .select("region")
    .gte("debute_le", new Date(maintenant.getTime() - 60 * 86_400_000).toISOString());
  const codes = new Set([REGION_PAR_DEFAUT, ...(recents ?? []).map((t) => t.region)]);
  const regions = REGIONS.filter((r) => codes.has(r.code));

  let total = 0;
  for (const region of regions) {
    let lignes;
    try {
      lignes = echeancesDepuisClash(region.code, await recupererTournoisClash(region.plateforme), maintenant);
    } catch {
      // Clé expirée, quota, réseau : on garde le calendrier tel quel.
      continue;
    }
    if (lignes.length > 0) {
      await admin.from("echeances").upsert(
        lignes.map((l) => ({ ...l, maj_le: maintenant.toISOString() })),
        { onConflict: "cle_externe" },
      );
    }
    // Phases annulées ou retirées par Riot depuis la dernière lecture.
    const garder = lignes.map((l) => l.cle_externe);
    let suppression = admin
      .from("echeances")
      .delete()
      .eq("source", "riot")
      .eq("region", region.code)
      .gt("debut_le", maintenant.toISOString());
    if (garder.length > 0) {
      suppression = suppression.not("cle_externe", "in", `(${garder.join(",")})`);
    }
    await suppression;
    total += lignes.length;
  }
  return { regions: regions.length, echeances: total };
}
