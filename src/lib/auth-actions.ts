"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { slugifier } from "@/lib/slug";
import { URL_SITE } from "@/lib/notifications";
import { estPseudoAutomatique, MESSAGE_PSEUDO_INVALIDE, PSEUDO_REGEX } from "@/lib/pseudo";
import { COOKIE_CONSENTEMENT, VERSION_CGU } from "@/lib/cgu";
import { cookies } from "next/headers";

// 8 caractères au moins (audit du 27/09/2026, F1 : Supabase en accepte 6
// par défaut). À aligner dans le tableau de bord Supabase (Authentication >
// Policies), qui s'applique aussi aux appels directs.
const MOT_DE_PASSE_MIN = 8;

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
  // Refus de la base à la création du profil (pseudo pris entre-temps).
  if (m.includes("database error saving new user")) return "Ce pseudo est déjà pris : essaies-en un autre.";
  if (m.includes("banned")) {
    return "Ce compte est suspendu. Le motif t'a été envoyé par e-mail ; pour contester, écris à l'adresse des mentions légales.";
  }
  if (m.includes("rate limit")) return "Trop de tentatives récentes, réessaie dans quelques minutes.";
  if (m.includes("email not confirmed")) return "Confirme ton adresse e-mail avant de te connecter (vérifie tes emails).";
  if (m.includes("password") && (m.includes("least") || m.includes("6"))) {
    return `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`;
  }
  if (m.includes("same") && m.includes("password")) {
    return "Choisis un mot de passe différent de l'ancien.";
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
        "Coche la case : 15 ans au moins (ou l'autorisation de ton représentant légal) et acceptation des CGU.",
      )}`,
    );
  }

  if (motDePasse.length < MOT_DE_PASSE_MIN) {
    redirect(
      `/inscription?erreur=${encodeURIComponent(`Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`)}`,
    );
  }

  if (!PSEUDO_REGEX.test(pseudo)) {
    redirect(`/inscription?erreur=${encodeURIComponent(MESSAGE_PSEUDO_INVALIDE)}`);
  }

  if (estPseudoAutomatique(pseudo)) {
    redirect(
      `/inscription?erreur=${encodeURIComponent(
        "Les pseudos « Joueur-… » sont réservés aux comptes qui n'ont pas encore choisi le leur.",
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

  // Pseudo déjà pris (majuscules près), ou ancienne adresse d'un joueur qui
  // a changé de pseudo (elle redirige vers son CV et ne se reprend pas).
  // La base refuse aussi ces cas, mais sans message lisible.
  const [{ data: pris }, { data: ancienneAdresse }] = await Promise.all([
    supabase.from("profiles").select("id").eq("slug", slug).maybeSingle(),
    supabase.from("anciens_slugs").select("slug").eq("slug", slug).maybeSingle(),
  ]);
  if (pris || ancienneAdresse) {
    redirect(`/inscription?erreur=${encodeURIComponent("Ce pseudo est déjà pris.")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    // version_cgu : date et version des CGU acceptées, conservées par la
    // base à la création du profil (handle_new_user).
    options: { data: { pseudo, slug, version_cgu: VERSION_CGU } },
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

// Ne fonctionne que si le provider "Discord" est activé dans Authentication
// > Providers du tableau de bord Supabase (Client ID/Secret d'une
// application créée sur discord.com/developers/applications) — pas
// possible à faire depuis le code, comme la protection anti-mots de passe
// compromis. Tant que ce n'est pas fait, Supabase renvoie une erreur
// explicite plutôt qu'un blocage silencieux.
export async function seConnecterAvecDiscord(formData: FormData) {
  // Même case à cocher que sInscrire — un compte créé via Discord au
  // premier clic ne passe jamais par /inscription, donc sans ça le
  // consentement d'âge (CGU) ne serait jamais capturé pour ce chemin.
  const ageConfirme = formData.get("age_confirme") === "on";
  if (!ageConfirme) {
    redirect(
      `/connexion?erreur=${encodeURIComponent(
        "Coche la case : 15 ans au moins (ou l'autorisation de ton représentant légal) et acceptation des CGU.",
      )}`,
    );
  }

  // Enregistré au retour de Discord si le compte vient d'être créé.
  (await cookies()).set(COOKIE_CONSENTEMENT, VERSION_CGU, {
    httpOnly: true,
    sameSite: "lax",
    secure: URL_SITE.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${URL_SITE}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(
      `/connexion?erreur=${encodeURIComponent(
        "Connexion Discord indisponible pour l'instant.",
      )}`,
    );
  }

  redirect(data.url);
}

export async function seDeconnecter() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Mot de passe oublié (28/09/2026, audit E6) : jusqu'ici, un oubli était un
// compte perdu. Supabase envoie un lien à usage unique ; il ramène sur
// /auth/callback, qui ouvre la session puis mène à /nouveau-mot-de-passe.
// Réponse identique que le compte existe ou non : la page ne doit pas
// permettre de deviner quelles adresses sont inscrites.
export async function demanderReinitialisation(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(`/mot-de-passe-oublie?erreur=${encodeURIComponent("Indique ton adresse e-mail.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${URL_SITE}/auth/callback?next=/nouveau-mot-de-passe`,
  });

  if (error && error.message.toLowerCase().includes("rate limit")) {
    redirect(`/mot-de-passe-oublie?erreur=${encodeURIComponent("Trop de demandes récentes, réessaie dans quelques minutes.")}`);
  }

  redirect(
    `/mot-de-passe-oublie?message=${encodeURIComponent(
      "Si un compte existe avec cette adresse, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe (valable 1 heure). Pense aux courriers indésirables.",
    )}`,
  );
}

export async function changerMotDePasse(formData: FormData) {
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(
      `/mot-de-passe-oublie?erreur=${encodeURIComponent("Lien expiré ou déjà utilisé : demande un nouvel e-mail.")}`,
    );
  }

  if (motDePasse.length < MOT_DE_PASSE_MIN) {
    redirect(
      `/nouveau-mot-de-passe?erreur=${encodeURIComponent(`Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`)}`,
    );
  }
  if (motDePasse !== confirmation) {
    redirect(`/nouveau-mot-de-passe?erreur=${encodeURIComponent("Les deux mots de passe ne sont pas identiques.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) {
    redirect(`/nouveau-mot-de-passe?erreur=${encodeURIComponent(traduireErreurAuth(error.message))}`);
  }

  redirect(`/moi?message=${encodeURIComponent("Mot de passe modifié.")}`);
}
