"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import {
  trouverRegion,
  resoudreRiotId,
  recupererInvocateur,
  traduireErreurRiot,
  type CompteRiot,
  type InvocateurRiot,
} from "@/lib/riot";

const ICONE_MIN = 1;
const ICONE_MAX = 28; // icônes de niveau classiques, stables sur tout patch/région

function tirerIconeCible(iconeActuelle: number): number {
  let cible = ICONE_MIN + Math.floor(Math.random() * (ICONE_MAX - ICONE_MIN + 1));
  if (cible === iconeActuelle) {
    cible = cible === ICONE_MAX ? ICONE_MIN : cible + 1;
  }
  return cible;
}

export async function lierRiotId(formData: FormData) {
  const riotId = String(formData.get("riot_id") ?? "").trim();
  const regionCode = String(formData.get("region") ?? "");

  const region = trouverRegion(regionCode);
  const [gameName, tagLine] = riotId.split("#").map((s) => s.trim());

  if (!region || !gameName || !tagLine) {
    redirect(
      `/lier-riot?erreur=${encodeURIComponent("Format attendu : Pseudo#Tag, avec une région valide.")}`,
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  let compte: CompteRiot;
  let invocateur: InvocateurRiot;
  try {
    compte = await resoudreRiotId(gameName, tagLine, region.continent);
    invocateur = await recupererInvocateur(compte.puuid, region.plateforme);
  } catch (e) {
    redirect(`/lier-riot?erreur=${encodeURIComponent(traduireErreurRiot(e))}`);
  }

  const cible = tirerIconeCible(invocateur.profileIconId);

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug.
  const { error } = await supabase.rpc("lier_compte_riot", {
    p_game_id: 1,
    p_puuid: compte.puuid,
    p_riot_game_name: compte.gameName,
    p_riot_tag_line: compte.tagLine,
    p_region: region.code,
    p_defi_icone_id: cible,
  });

  if (error) {
    const message = error.message.includes("RIOT_ACCOUNT_TAKEN")
      ? "Ce compte Riot est déjà lié à un autre profil Najarena."
      : "Impossible d'enregistrer ce compte pour l'instant.";
    redirect(`/lier-riot?erreur=${encodeURIComponent(message)}`);
  }

  redirect("/lier-riot");
}

export async function verifierRiotId(formData: FormData) {
  const puuid = String(formData.get("puuid") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: compte } = await supabase
    .from("game_accounts")
    .select("region, defi_icone_id")
    .eq("puuid", puuid)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!compte || compte.defi_icone_id === null) {
    redirect(`/lier-riot?erreur=${encodeURIComponent("Aucune vérification en attente.")}`);
  }

  const region = trouverRegion(compte.region);
  if (!region) {
    redirect(
      `/lier-riot?erreur=${encodeURIComponent("Région inconnue, relie ton compte à nouveau.")}`,
    );
  }

  let invocateur: InvocateurRiot;
  try {
    invocateur = await recupererInvocateur(puuid, region.plateforme);
  } catch (e) {
    redirect(`/lier-riot?erreur=${encodeURIComponent(traduireErreurRiot(e))}`);
  }

  if (invocateur.profileIconId !== compte.defi_icone_id) {
    redirect(
      `/lier-riot?erreur=${encodeURIComponent(
        "Ton icône actuelle ne correspond pas encore. Vérifie que le changement est bien sauvegardé en jeu, puis réessaie.",
      )}`,
    );
  }

  // Écriture volontairement hors RLS : c'est la seule preuve de vérification
  // du site, elle ne doit jamais être atteignable par une policy client.
  // Le contrôle de sécurité vient d'avoir lieu juste au-dessus, contre
  // l'API Riot en direct — ce client n'est utilisé qu'après.
  const admin = creerClientAdmin();
  if (!admin) {
    redirect(
      `/lier-riot?erreur=${encodeURIComponent(
        "La confirmation finale n'est pas encore activée côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante).",
      )}`,
    );
  }

  const maintenant = new Date().toISOString();
  await admin
    .from("game_accounts")
    .update({ verifie_le: maintenant, derniere_sync_le: maintenant, defi_icone_id: null })
    .eq("puuid", puuid)
    .eq("profile_id", userData.user.id);

  redirect("/moi");
}
