"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { messageRefusDefi } from "@/lib/defis";

// Défis entre joueurs (28/09/2026, audit N16 et N18). Toutes les règles —
// comptes Riot vérifiés dans la même région, un défi en attente par paire,
// plafonds, défi classé ou amical — sont appliquées par la base
// (docs/schema.sql) ; ces actions appellent ses fonctions, puis préviennent
// l'autre joueur (push et message privé Discord).

function condition(formData: FormData): "nexus" | "classique" {
  return formData.get("condition_victoire") === "classique" ? "classique" : "nexus";
}

function versDefis(type: "message" | "erreur", texte: string): never {
  redirect(`/moi?${type}=${encodeURIComponent(texte)}#defis`);
}

async function session() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  return { supabase, utilisateur: userData.user };
}

async function pseudoDe(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("pseudo").eq("id", id).maybeSingle();
  return data?.pseudo ?? "Un joueur";
}

export async function lancerDefi(formData: FormData) {
  const adversaireId = String(formData.get("adversaire_id") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("lancer_defi", {
    p_adversaire_id: adversaireId,
    p_condition: condition(formData),
  });
  if (error) versDefis("erreur", messageRefusDefi(error.message, "Impossible d'envoyer ce défi pour l'instant."));

  await envoyerRappel(
    adversaireId,
    `${await pseudoDe(supabase, utilisateur.id)} te défie en 1v1`,
    "Une partie, résultat lu chez Riot. Accepte ou refuse depuis ton espace dans les 24 h.",
    `${URL_SITE}/moi#defis`,
  );
  versDefis("message", "Défi envoyé : ton adversaire a 24 h pour répondre.");
}

export async function repondreDefi(formData: FormData) {
  const defiId = String(formData.get("defi_id") ?? "");
  const accepte = formData.get("reponse") === "accepter";
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { data: slug, error } = await supabase.rpc("repondre_defi", { p_defi_id: defiId, p_accepte: accepte });
  if (error) versDefis("erreur", messageRefusDefi(error.message, "Impossible de répondre à ce défi pour l'instant."));

  const { data: defi } = await supabase.from("defis").select("lanceur_id").eq("id", defiId).maybeSingle();
  if (defi) {
    const pseudo = await pseudoDe(supabase, utilisateur.id);
    await envoyerRappel(
      defi.lanceur_id,
      accepte ? `${pseudo} relève ton défi` : `${pseudo} a refusé ton défi`,
      accepte
        ? "Le duel est ouvert : déclare-toi prêt dans la salle de match."
        : "Tu peux défier un autre joueur depuis son profil.",
      accepte && slug ? `${URL_SITE}/lol/tournois/${slug}#ton-match` : `${URL_SITE}/moi#defis`,
    );
  }

  if (accepte && slug) redirect(`/lol/tournois/${slug}#ton-match`);
  versDefis("message", "Défi refusé.");
}

export async function creerInvitationDefi(formData: FormData) {
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("creer_invitation_defi", { p_condition: condition(formData) });
  if (error) versDefis("erreur", messageRefusDefi(error.message, "Impossible de créer ce lien pour l'instant."));
  versDefis("message", "Lien de défi créé : envoie-le à ton rival, il est valable 7 jours.");
}

export async function accepterInvitationDefi(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const page = `/defi/${encodeURIComponent(code)}`;
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect(`/connexion?suite=${encodeURIComponent(page)}`);

  const { data: slug, error } = await supabase.rpc("accepter_invitation_defi", { p_code: code });
  if (error || !slug) {
    redirect(
      `${page}?erreur=${encodeURIComponent(messageRefusDefi(error?.message ?? "", "Impossible de relever ce défi pour l'instant."))}`,
    );
  }

  const { data: defi } = await supabase.from("defis").select("lanceur_id").eq("code_invitation", code).maybeSingle();
  if (defi) {
    await envoyerRappel(
      defi.lanceur_id,
      `${await pseudoDe(supabase, utilisateur.id)} relève ton défi`,
      "Ton lien de défi a trouvé preneur : le duel est ouvert, déclare-toi prêt dans la salle de match.",
      `${URL_SITE}/lol/tournois/${slug}#ton-match`,
    );
  }
  redirect(`/lol/tournois/${slug}#ton-match`);
}

export async function annulerDefi(formData: FormData) {
  const defiId = String(formData.get("defi_id") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  await supabase.rpc("annuler_defi", { p_defi_id: defiId });
  versDefis("message", "Défi retiré.");
}
