"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { envoyerCodeEcole, URL_SITE } from "@/lib/notifications";
import { DUREE_CODE_ECOLE_MINUTES, lireDomaines, messageRefusEcole } from "@/lib/ecoles";

// Ligues écoles et universités (04/10/2026). Toutes les règles (fondateur
// seul, domaines refusés, limites d'envoi et d'essais, une adresse pour un
// seul compte) sont appliquées par la base ; ces actions l'appellent.

async function session() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  return { supabase, utilisateur: userData.user };
}

function versEcole(slug: string, type: "message" | "erreur", texte: string, codeEnvoye = false): never {
  redirect(
    `/communaute/${encodeURIComponent(slug)}?${type}=${encodeURIComponent(texte)}${codeEnvoye ? "&verification=envoyee" : ""}#ecole`,
  );
}

// Le fondateur indique le domaine des adresses de l'établissement : sa
// communauté devient une école (ou change de domaines).
export async function definirEcole(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { error } = await supabase.rpc("definir_ecole", {
    p_communaute_id: id,
    p_domaines: lireDomaines(String(formData.get("domaines") ?? "")),
  });
  if (error) versEcole(slug, "erreur", messageRefusEcole(error.message, "Enregistrement impossible pour l'instant."));
  revalidatePath(`/communaute/${slug}`);
  revalidatePath("/lol/ecoles");
  versEcole(slug, "message", "Adresses de l'établissement enregistrées : tes membres peuvent maintenant vérifier la leur.");
}

// Un membre demande un code à son adresse d'école. Le code est tiré ici,
// côté serveur, et la base n'en garde qu'une empreinte : un joueur qui
// choisirait son code se vérifierait sans posséder l'adresse.
export async function demanderCodeEcole(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect(`/connexion?suite=${encodeURIComponent(`/communaute/${slug}`)}`);

  const admin = creerClientAdmin();
  if (!admin) versEcole(slug, "erreur", "La vérification des adresses d'école n'est pas disponible pour l'instant.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { data: domaine, error } = await admin.rpc("preparer_verification_ecole", {
    p_profile_id: utilisateur.id,
    p_communaute_id: id,
    p_email: email,
    p_code: code,
  });
  if (error) versEcole(slug, "erreur", messageRefusEcole(error.message, "Impossible d'envoyer un code pour l'instant."));

  const { data: communaute } = await supabase.from("communautes").select("nom").eq("id", id).maybeSingle();
  const envoye = await envoyerCodeEcole(
    email,
    communaute?.nom ?? "ton école",
    code,
    DUREE_CODE_ECOLE_MINUTES,
    `${URL_SITE}/communaute/${encodeURIComponent(slug)}?verification=envoyee#ecole`,
  );
  if (!envoye) versEcole(slug, "erreur", "L'e-mail n'a pas pu partir. Réessaie dans quelques minutes.");
  versEcole(
    slug,
    "message",
    `Code envoyé à ton adresse @${domaine} : il vaut ${DUREE_CODE_ECOLE_MINUTES} minutes. Pense à regarder les indésirables.`,
    true,
  );
}

export async function confirmerCodeEcole(formData: FormData) {
  const id = String(formData.get("communaute_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const { supabase, utilisateur } = await session();
  if (!utilisateur) redirect("/connexion");

  const { data: verifie, error } = await supabase.rpc("confirmer_verification_ecole", {
    p_communaute_id: id,
    p_code: code,
  });
  if (error) versEcole(slug, "erreur", messageRefusEcole(error.message, "Vérification impossible pour l'instant."));
  if (!verifie) versEcole(slug, "erreur", "Code incorrect : recopie celui de l'e-mail reçu.", true);
  revalidatePath(`/communaute/${slug}`);
  revalidatePath("/lol/ecoles");
  versEcole(slug, "message", "Adresse vérifiée : tu comptes maintenant pour ton école.");
}
