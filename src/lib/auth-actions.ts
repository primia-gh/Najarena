"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { slugifier } from "@/lib/slug";

const PSEUDO_REGEX = /^[a-zA-Z0-9 _-]{3,20}$/;

// Anti-brute-force sur la connexion (audit du 2026-09-11 §10 Sécurité).
// Repli gracieux identique aux autres usages du service_role : sans
// SUPABASE_SERVICE_ROLE_KEY, on ne bloque jamais personne plutôt que de
// bloquer tout le monde par erreur.
const FENETRE_LIMITE_MINUTES = 15;
const SEUIL_TENTATIVES = 5;
const RETENTION_HEURES = 24;

async function tropDeTentatives(email: string): Promise<boolean> {
  const admin = creerClientAdmin();
  if (!admin) return false;

  const emailNormalise = email.toLowerCase();

  await admin
    .from("login_attempts")
    .delete()
    .lt("cree_le", new Date(Date.now() - RETENTION_HEURES * 60 * 60 * 1000).toISOString());

  const { count } = await admin
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("email", emailNormalise)
    .gte("cree_le", new Date(Date.now() - FENETRE_LIMITE_MINUTES * 60 * 1000).toISOString());

  return (count ?? 0) >= SEUIL_TENTATIVES;
}

async function enregistrerTentativeEchouee(email: string): Promise<void> {
  const admin = creerClientAdmin();
  if (!admin) return;
  await admin.from("login_attempts").insert({ email: email.toLowerCase() });
}

function traduireErreurAuth(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate key") || m.includes("already registered") || m.includes("already exists")) {
    return m.includes("pseudo") || m.includes("slug")
      ? "Ce pseudo est déjà pris."
      : "Un compte existe déjà avec cet e-mail.";
  }
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("rate limit")) return "Trop de tentatives récentes, réessaie dans quelques minutes.";
  if (m.includes("email not confirmed")) return "Confirme ton adresse e-mail avant de te connecter (vérifie tes emails).";
  if (m.includes("password") && (m.includes("least") || m.includes("6"))) {
    return "Le mot de passe doit faire au moins 6 caractères.";
  }
  if (
    m.includes("unable to validate email") ||
    m.includes("invalid email") ||
    m.includes("invalid format") ||
    (m.includes("email") && m.includes("invalid"))
  ) {
    return "Adresse e-mail invalide.";
  }
  return "Une erreur est survenue. Réessaie.";
}

export async function sInscrire(formData: FormData) {
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const ageConfirme = formData.get("age_confirme") === "on";

  if (!ageConfirme) {
    redirect(
      `/inscription?erreur=${encodeURIComponent(
        "Tu dois confirmer avoir au moins 15 ans, ou l'autorisation de ton représentant légal.",
      )}`,
    );
  }

  if (!PSEUDO_REGEX.test(pseudo)) {
    redirect(
      `/inscription?erreur=${encodeURIComponent(
        "Le pseudo doit faire entre 3 et 20 caractères (lettres, chiffres, espaces, - ou _).",
      )}`,
    );
  }

  const slug = slugifier(pseudo);
  if (!slug) {
    redirect(
      `/inscription?erreur=${encodeURIComponent(
        "Ce pseudo ne peut pas servir d'identifiant, essaie avec des lettres ou des chiffres.",
      )}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: { data: { pseudo, slug } },
  });

  if (error) {
    redirect(`/inscription?erreur=${encodeURIComponent(traduireErreurAuth(error.message))}`);
  }

  if (!data.session) {
    redirect(
      `/connexion?message=${encodeURIComponent(
        "Compte créé. Vérifie tes emails pour confirmer ton adresse avant de te connecter.",
      )}`,
    );
  }

  redirect("/moi");
}

export async function seConnecter(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");

  if (email && (await tropDeTentatives(email))) {
    redirect(
      `/connexion?erreur=${encodeURIComponent(
        "Trop de tentatives échouées pour cette adresse. Réessaie dans quelques minutes.",
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    await enregistrerTentativeEchouee(email);
    redirect(`/connexion?erreur=${encodeURIComponent(traduireErreurAuth(error.message))}`);
  }

  redirect("/moi");
}

export async function seDeconnecter() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
