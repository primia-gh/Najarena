"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { chargerOffre, ORDRE_OFFRE } from "@/lib/offres";
import { chargerMoyennes } from "@/lib/revue-match";
import { demanderJson, MODELE_IA } from "@/lib/claude";
import { construireDemandeRevue, SCHEMA_REVUE, validerRevue } from "@/lib/revue-ia";

// Revue de match détaillée, rédigée par l'IA (03/10/2026, audit N25) : à la
// demande du joueur (offre Elite), une fois par match, dans la limite des
// demandes à l'IA (10 par 24 h, partagée avec l'assistant organisateur).
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

  const [{ data: existante }, { data: stats }, { data: match }] = await Promise.all([
    supabase.from("revues_match_ia").select("match_id").eq("match_id", matchId).eq("profile_id", moi).maybeSingle(),
    supabase
      .from("stats_match_joueur")
      .select("profile_id, champion, kills, deaths, assists, cs, or_gagne, duree_secondes, gagne")
      .eq("match_id", matchId),
    supabase.from("matches").select("tournament:tournaments(format)").eq("id", matchId).maybeSingle(),
  ]);
  if (existante) retour("deja");
  const mesStats = stats?.find((s) => s.profile_id === moi);
  if (!mesStats) return retour("sans-stats");

  const { data: autorise } = await supabase.rpc("reserver_appel_assistant_ia");
  if (!autorise) retour("limite");

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
  const adversaire = format === "1v1" ? stats?.find((s) => s.profile_id !== moi) : undefined;
  const moyennes = await chargerMoyennes(supabase, moi);

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
  });
  if (!resultat.ok) return retour(resultat.raison);

  const admin = creerClientAdmin();
  if (!admin) return retour("indisponible");
  const { error } = await admin.from("revues_match_ia").insert({
    match_id: matchId,
    profile_id: moi,
    points: resultat.valeur.points,
    conseil: resultat.valeur.conseil,
    modele: MODELE_IA,
  });
  retour(error ? "indisponible" : "ok");
}
