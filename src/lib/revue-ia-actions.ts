"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { chargerOffre, ORDRE_OFFRE } from "@/lib/offres";
import { redigerRevue } from "@/lib/revue-ia-serveur";

// Revue de match détaillée, rédigée par l'IA (03/10/2026, audit N25) : à la
// demande du joueur (offre Elite), une fois par match, dans la limite des
// demandes à l'IA (10 par 24 h, partagée avec l'assistant organisateur).
// Les parties vérifiées récentes sont aussi analysées automatiquement
// (src/lib/revue-ia-serveur.ts) ; le bouton sert pour les plus anciennes.
// Le résultat ?revue=… est lu par la page du CV.
export async function demanderRevueIA(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const retour: (code: string) => never = (code) => redirect(`/joueur/${slug}?revue=${code}#historique`);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }
  const moi = userData.user.id;

  const { offre } = await chargerOffre(supabase, moi);
  if (ORDRE_OFFRE[offre] < ORDRE_OFFRE.elite) {
    retour("offre");
  }

  const [{ data: existante }, { data: mesStats }] = await Promise.all([
    supabase.from("revues_match_ia").select("match_id").eq("match_id", matchId).eq("profile_id", moi).maybeSingle(),
    supabase.from("stats_match_joueur").select("match_id").eq("match_id", matchId).eq("profile_id", moi).maybeSingle(),
  ]);
  if (existante) retour("deja");
  if (!mesStats) retour("sans-stats");

  const { data: autorise } = await supabase.rpc("reserver_appel_assistant_ia");
  if (!autorise) retour("limite");

  const admin = creerClientAdmin();
  if (!admin) return retour("indisponible");
  retour(await redigerRevue(admin, matchId, moi));
}
