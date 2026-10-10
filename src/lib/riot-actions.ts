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
import { ROLES, type Role } from "@/lib/roles";
import { cookies } from "next/headers";
import { destinationInterne } from "@/lib/redirection";
import { COOKIE_SUITE, DUREE_COOKIE_SUITE_SECONDES } from "@/lib/suite";
import { URL_SITE } from "@/lib/notifications";

const ICONE_MIN = 1;
const ICONE_MAX = 28; // icônes de niveau classiques, stables sur tout patch/région

const MESSAGE_LIMITE_RIOT =
  "Trop d'essais en une heure (10 au plus, liaisons et vérifications d'icône comprises) : attends un peu avant de réessayer.";

// Chaque essai interroge l'API Riot, dont le quota est partagé par tout le
// site : 10 essais par heure et par joueur, comptés par la base (audit
// sécurité du 10/10/2026, M7 ; consommer_limite). Refus aussi en cas
// d'erreur, pour ne jamais laisser passer un appel non compté.
async function reserverEssaiRiot(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data, error } = await supabase.rpc("consommer_limite", { p_action: "liaison_riot" });
  return !error && data === true;
}

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
  // Compte secondaire déclaré (audit N15) : affiché sur le CV, mais ni
  // inscription ni lecture des résultats.
  const principal = formData.get("principal") !== "non";

  const region = trouverRegion(regionCode);
  const [gameName, tagLine] = riotId.split("#").map((s) => s.trim());

  if (!region || !gameName || !tagLine) {
    redirect(`/lier-riot?erreur=${encodeURIComponent("Format attendu : Pseudo#Tag, avec une région valide.")}`);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  if (!(await reserverEssaiRiot(supabase))) {
    redirect(`/lier-riot?erreur=${encodeURIComponent(MESSAGE_LIMITE_RIOT)}`);
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

  // Écriture réservée au serveur (audit du 27/09/2026, C2) : appelable
  // depuis le navigateur, lier_compte_riot laissait le joueur choisir lui-
  // même le puuid, le nom affiché et l'icône-défi — donc « vérifier » un
  // compte Riot qui n'était pas le sien en indiquant l'icône déjà portée.
  // Ici, puuid et Riot ID viennent de la réponse Riot, l'icône-défi est
  // tirée par le serveur (toujours différente de l'icône actuelle), et le
  // profil vient de la session.
  const admin = creerClientAdmin();
  if (!admin) {
    redirect(
      `/lier-riot?erreur=${encodeURIComponent(
        "La liaison n'est pas encore activée côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante).",
      )}`,
    );
  }

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug.
  const { error } = await admin.rpc("lier_compte_riot", {
    p_profile_id: userData.user.id,
    p_game_id: 1,
    p_puuid: compte.puuid,
    p_riot_game_name: compte.gameName,
    p_riot_tag_line: compte.tagLine,
    p_region: region.code,
    p_defi_icone_id: cible,
    p_principal: principal,
  });

  if (error) {
    const message = error.message.includes("RIOT_ACCOUNT_TAKEN")
      ? "Ce compte Riot est déjà lié à un autre profil Najarena."
      : error.message.includes("INSCRIT_A_UN_TOURNOI")
        ? "Tu joues un tournoi pas encore terminé avec ton compte actuel : déclare ce compte comme secondaire, ou attends la fin du tournoi pour en changer."
        : error.message.includes("TROP_DE_COMPTES")
          ? "Trois comptes Riot au plus par joueur : retire un compte secondaire d'abord."
          : "Impossible d'enregistrer ce compte pour l'instant.";
    redirect(`/lier-riot?erreur=${encodeURIComponent(message)}`);
  }

  // Page où revenir une fois le compte vérifié (lien de défi, audit N18).
  const suite = destinationInterne(String(formData.get("suite") ?? "") || null, "");
  if (suite) {
    (await cookies()).set(COOKIE_SUITE, suite, {
      httpOnly: true,
      sameSite: "lax",
      secure: URL_SITE.startsWith("https://"),
      maxAge: DUREE_COOKIE_SUITE_SECONDES,
      path: "/",
    });
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
    .select("region, defi_icone_id, est_principal")
    .eq("puuid", puuid)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!compte || compte.defi_icone_id === null) {
    redirect(`/lier-riot?erreur=${encodeURIComponent("Aucune vérification en attente.")}`);
  }

  const region = trouverRegion(compte.region);
  if (!region) {
    redirect(`/lier-riot?erreur=${encodeURIComponent("Région inconnue, relie ton compte à nouveau.")}`);
  }

  if (!(await reserverEssaiRiot(supabase))) {
    redirect(`/lier-riot?erreur=${encodeURIComponent(MESSAGE_LIMITE_RIOT)}`);
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

  // Compte secondaire : retour à la liste des comptes.
  if (!compte.est_principal) {
    redirect(`/lier-riot?message=${encodeURIComponent("Compte secondaire vérifié : il apparaît sur ton CV.")}`);
  }

  const magasin = await cookies();
  const suite = destinationInterne(magasin.get(COOKIE_SUITE)?.value ?? null, "");
  if (suite) {
    magasin.delete(COOKIE_SUITE);
    redirect(suite);
  }
  redirect("/moi");
}

// game_accounts n'a aucune policy client UPDATE — volontairement : des
// colonnes comme verifie_le/puuid ne doivent jamais être écrivables par le
// joueur, et une policy "propriétaire" classique s'appliquerait à toute la
// ligne, pas seulement à role_prefere. Même contournement que verifierRiotId
// ci-dessus : contrôle d'identité côté serveur, puis écriture service_role.
export async function mettreAJourRolePrefere(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const role = String(formData.get("role_prefere") ?? "");
  if (role && !(ROLES as string[]).includes(role)) {
    redirect(`/moi?erreur=${encodeURIComponent("Rôle invalide.")}`);
  }

  const admin = creerClientAdmin();
  if (!admin) {
    redirect(`/moi?erreur=${encodeURIComponent("Mise à jour indisponible pour l'instant.")}`);
  }

  await admin
    .from("game_accounts")
    .update({ role_prefere: (role || null) as Role | null })
    .eq("profile_id", userData.user.id)
    .eq("est_principal", true);

  redirect("/moi?message=" + encodeURIComponent("Rôle mis à jour."));
}

// Délier son compte Riot (28/09/2026, audit M9) : erreur de saisie,
// vérification jamais terminée, changement de compte. La base refuse tant
// que le joueur est inscrit à un tournoi pas encore terminé
// (delier_compte_riot, docs/schema.sql).
export async function delierCompteRiot() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("delier_compte_riot", { p_game_id: 1 });
  if (error) {
    const message = error.message.includes("INSCRIT_A_UN_TOURNOI")
      ? "Tu es engagé dans un tournoi pas encore terminé (inscrit, aligné dans une équipe ou agent libre) : ton compte Riot sert à lire tes résultats. Attends la fin du tournoi, ou retire-toi d'abord (désinscription, liste des agents libres, ou demande à ton capitaine)."
      : "Impossible de délier ton compte pour l'instant. Réessaie dans un instant.";
    redirect(`/lier-riot?erreur=${encodeURIComponent(message)}`);
  }

  redirect(`/lier-riot?message=${encodeURIComponent("Compte Riot délié : tu peux en lier un autre.")}`);
}

// Comptes secondaires déclarés (03/10/2026, audit N15) : un compte vérifié
// devient le principal (refusé pendant un tournoi pas encore terminé), ou
// un compte secondaire est retiré. Règles appliquées par la base.
export async function definirComptePrincipal(formData: FormData) {
  const puuid = String(formData.get("puuid") ?? "");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("definir_compte_principal", { p_game_id: 1, p_puuid: puuid });
  if (error) {
    const message = error.message.includes("INSCRIT_A_UN_TOURNOI")
      ? "Tu joues un tournoi pas encore terminé : ses résultats sont lus sur ton compte actuel. Change de compte principal après la fin du tournoi."
      : error.message.includes("COMPTE_NON_VERIFIE")
        ? "Vérifie d'abord ce compte (icône de profil)."
        : "Impossible de changer de compte principal pour l'instant.";
    redirect(`/lier-riot?erreur=${encodeURIComponent(message)}`);
  }
  redirect(
    `/lier-riot?message=${encodeURIComponent("Compte principal changé : c'est lui qui t'inscrit désormais aux tournois.")}`,
  );
}

export async function delierCompteSecondaire(formData: FormData) {
  const puuid = String(formData.get("puuid") ?? "");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: retire } = await supabase.rpc("delier_compte_secondaire", { p_game_id: 1, p_puuid: puuid });
  redirect(
    retire
      ? `/lier-riot?message=${encodeURIComponent("Compte secondaire retiré.")}`
      : `/lier-riot?erreur=${encodeURIComponent("Aucun compte secondaire à retirer.")}`,
  );
}
