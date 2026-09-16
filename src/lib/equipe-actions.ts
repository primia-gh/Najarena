"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugifier } from "@/lib/slug";
import { notifierJoueur, URL_SITE } from "@/lib/notifications";
import { TAILLE_MAX_EQUIPE } from "@/lib/equipe";
import { chargerOffre, ORDRE_OFFRE } from "@/lib/offres";
import type { TablesUpdate } from "@/lib/supabase/types";

// 2 à 5 lettres/chiffres, convention standard des tags d'équipe esport.
const TAG_REGEX = /^[A-Za-z0-9]{2,5}$/;

export async function creerEquipe(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const nom = String(formData.get("nom") ?? "").trim();
  const tag = String(formData.get("tag") ?? "").trim().toUpperCase();

  if (nom.length < 3 || nom.length > 40) {
    redirect(
      `/equipe/nouvelle?erreur=${encodeURIComponent("Le nom doit faire entre 3 et 40 caractères.")}`,
    );
  }

  if (!TAG_REGEX.test(tag)) {
    redirect(
      `/equipe/nouvelle?erreur=${encodeURIComponent("Le tag doit faire 2 à 5 lettres ou chiffres.")}`,
    );
  }

  const slug = `${slugifier(nom)}-${Math.random().toString(36).slice(2, 7)}`;

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug.
  const { data: equipe, error } = await supabase
    .from("teams")
    .insert({ game_id: 1, slug, nom, tag, capitaine_id: userData.user.id })
    .select("id, slug")
    .single();

  if (error || !equipe) {
    redirect(
      `/equipe/nouvelle?erreur=${encodeURIComponent("Impossible de créer l'équipe pour l'instant.")}`,
    );
  }

  // Le capitaine est automatiquement membre, déjà accepté — pas d'invitation
  // à soi-même. La policy RLS "capitaine invite un membre" l'autorise ici
  // puisque capitaine_id vient d'être fixé à son propre id.
  await supabase.from("team_members").insert({
    team_id: equipe.id,
    profile_id: userData.user.id,
    role: "Capitaine",
    accepte_le: new Date().toISOString(),
  });

  redirect(`/equipe/${equipe.slug}`);
}

export async function inviterMembre(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const teamId = String(formData.get("team_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const pseudoInvite = String(formData.get("pseudo") ?? "").trim();

  if (!pseudoInvite) {
    redirect(
      `/equipe/${slug}?erreur=${encodeURIComponent("Indique le pseudo du joueur à inviter.")}`,
    );
  }

  // Le pseudo cherché et le comptage de l'effectif sont indépendants l'un
  // de l'autre — lancés en parallèle plutôt qu'en série (correctif du
  // 13/09/2026, même logique que sur l'accueil).
  const [{ data: profil }, { count }] = await Promise.all([
    supabase.from("profiles").select("id, pseudo").ilike("pseudo", pseudoInvite).maybeSingle(),
    // Vérification applicative, en plus de la policy RLS "capitaine invite
    // un membre" (qui revérifie elle-même l'identité du capitaine) : rien
    // côté base n'empêche encore un roster de dépasser 5 joueurs, et
    // /lol/coequipiers affiche maintenant "de la place" comme un fait sur
    // lequel on s'engage.
    supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .not("accepte_le", "is", null),
  ]);

  if (!profil) {
    redirect(`/equipe/${slug}?erreur=${encodeURIComponent("Aucun joueur avec ce pseudo.")}`);
  }

  if ((count ?? 0) >= TAILLE_MAX_EQUIPE) {
    redirect(
      `/equipe/${slug}?erreur=${encodeURIComponent(`Équipe déjà complète (${TAILLE_MAX_EQUIPE} joueurs pour un format 5v5).`)}`,
    );
  }

  // La policy RLS "capitaine invite un membre" revérifie elle-même que
  // l'appelant est bien le capitaine de cette équipe — aucun contrôle de
  // confiance ici.
  const { error } = await supabase.from("team_members").insert({
    team_id: teamId,
    profile_id: profil.id,
  });

  if (error) {
    redirect(
      `/equipe/${slug}?erreur=${encodeURIComponent(
        "Impossible d'inviter ce joueur — déjà membre, déjà invité, ou tu n'es pas capitaine.",
      )}`,
    );
  }

  const { data: equipe } = await supabase
    .from("teams")
    .select("nom, tag")
    .eq("id", teamId)
    .maybeSingle();

  if (equipe) {
    await notifierJoueur(
      profil.id,
      `Invitation d'équipe — ${equipe.nom}`,
      `${equipe.tag} ${equipe.nom} t'invite à rejoindre l'équipe`,
      `<p>Tu peux accepter ou refuser depuis ton tableau de bord.</p>
       <p><a href="${URL_SITE}/moi">Voir mon tableau de bord</a></p>`,
    );
  }

  redirect(`/equipe/${slug}?message=${encodeURIComponent(`Invitation envoyée à ${profil.pseudo}.`)}`);
}

export async function accepterInvitation(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const teamId = String(formData.get("team_id") ?? "");

  await supabase
    .from("team_members")
    .update({ accepte_le: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("profile_id", userData.user.id);

  redirect("/moi");
}

export async function refuserInvitation(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const teamId = String(formData.get("team_id") ?? "");

  // Même action pour "refuser une invitation" et "quitter l'équipe" — dans
  // les deux cas, le joueur retire sa propre ligne. La policy RLS "membre
  // quitte ou capitaine retire" l'autorise.
  await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("profile_id", userData.user.id);

  redirect("/moi");
}

// Description/contact recrutement restent ouverts à tout capitaine ; logo
// et couleur d'accent sont réservés à l'offre Vérifié+ — vérifié ici, pas
// seulement caché côté formulaire. L'update passe par le client RLS normal
// (pas creerClientAdmin) : "capitaine modifie son equipe" l'autorise déjà,
// contrairement à comptes_offres qui n'a aucune policy client.
export async function mettreAJourEquipe(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const teamId = String(formData.get("team_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  const contactRecrutement = String(formData.get("contact_recrutement") ?? "").trim().slice(0, 200);

  const { offre } = await chargerOffre(supabase, userData.user.id);
  const peutBranding = ORDRE_OFFRE[offre] >= ORDRE_OFFRE.verifie;

  const misesAJour: TablesUpdate<"teams"> = {
    description: description || null,
    contact_recrutement: contactRecrutement || null,
  };

  if (peutBranding) {
    const logoUrl = String(formData.get("logo_url") ?? "").trim();
    const couleurAccent = String(formData.get("couleur_accent") ?? "").trim();
    misesAJour.logo_url = logoUrl || null;
    misesAJour.couleur_accent = couleurAccent || null;
  }

  const { error } = await supabase
    .from("teams")
    .update(misesAJour)
    .eq("id", teamId)
    .eq("capitaine_id", userData.user.id);

  if (error) {
    redirect(`/equipe/${slug}?erreur=${encodeURIComponent("Impossible de mettre à jour l'équipe pour l'instant.")}`);
  }

  redirect(`/equipe/${slug}?message=${encodeURIComponent("Équipe mise à jour.")}`);
}

export async function retirerMembre(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const teamId = String(formData.get("team_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  await supabase.from("team_members").delete().eq("team_id", teamId).eq("profile_id", profileId);

  redirect(`/equipe/${slug}`);
}
