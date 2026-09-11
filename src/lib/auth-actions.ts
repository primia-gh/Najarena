"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugifier } from "@/lib/slug";

const PSEUDO_REGEX = /^[a-zA-Z0-9 _-]{3,20}$/;

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    redirect(`/connexion?erreur=${encodeURIComponent(traduireErreurAuth(error.message))}`);
  }

  redirect("/moi");
}

export async function seDeconnecter() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
