"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugifier } from "@/lib/slug";
import { notifierDiscord, URL_SITE } from "@/lib/notifications";
import { formaterDate } from "@/lib/tournois";

const CAPACITES = [4, 8, 16, 32, 64] as const;

export async function creerTournoi(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const nom = String(formData.get("nom") ?? "").trim();
  const capacite = Number(formData.get("capacite"));
  const region = String(formData.get("region") ?? "");
  const debuteLeBrut = String(formData.get("debute_le") ?? "");
  const checkinOuvreLeBrut = String(formData.get("checkin_ouvre_le") ?? "");
  const publier = formData.get("statut_initial") === "ouvert";

  if (nom.length < 3 || nom.length > 60) {
    redirect(
      `/organiser/nouveau?erreur=${encodeURIComponent("Le nom doit faire entre 3 et 60 caractères.")}`,
    );
  }

  if (!(CAPACITES as readonly number[]).includes(capacite)) {
    redirect(`/organiser/nouveau?erreur=${encodeURIComponent("Capacité invalide.")}`);
  }

  if (!region) {
    redirect(`/organiser/nouveau?erreur=${encodeURIComponent("Choisis une région.")}`);
  }

  const debuteLe = new Date(debuteLeBrut);
  const checkinOuvreLe = new Date(checkinOuvreLeBrut);

  if (Number.isNaN(debuteLe.getTime()) || Number.isNaN(checkinOuvreLe.getTime())) {
    redirect(`/organiser/nouveau?erreur=${encodeURIComponent("Dates invalides.")}`);
  }

  if (debuteLe.getTime() <= Date.now()) {
    redirect(
      `/organiser/nouveau?erreur=${encodeURIComponent("La date de début doit être dans le futur.")}`,
    );
  }

  if (checkinOuvreLe.getTime() > debuteLe.getTime()) {
    redirect(
      `/organiser/nouveau?erreur=${encodeURIComponent(
        "Le check-in doit s'ouvrir avant (ou au moment de) le début du tournoi.",
      )}`,
    );
  }

  const { data: jeu } = await supabase.from("games").select("id").eq("slug", "lol").maybeSingle();
  if (!jeu) {
    redirect(`/organiser/nouveau?erreur=${encodeURIComponent("Service indisponible pour l'instant.")}`);
  }

  const slug = `${slugifier(nom)}-${Math.random().toString(36).slice(2, 7)}`;

  const { error } = await supabase.from("tournaments").insert({
    game_id: jeu.id,
    organisateur_id: userData.user.id,
    slug,
    nom,
    format: "1v1",
    capacite,
    region,
    debute_le: debuteLe.toISOString(),
    checkin_ouvre_le: checkinOuvreLe.toISOString(),
    statut: publier ? "ouvert" : "brouillon",
  });

  if (error) {
    redirect(
      `/organiser/nouveau?erreur=${encodeURIComponent("Impossible de créer le tournoi pour l'instant.")}`,
    );
  }

  if (publier) {
    await notifierDiscord(
      `📣 Nouveau tournoi ouvert — **${nom}** (${capacite} joueurs, ${region}), débute le ${formaterDate(debuteLe.toISOString())}.\n${URL_SITE}/lol/tournois/${slug}`,
    );
    redirect(`/lol/tournois/${slug}`);
  }

  redirect(
    `/moi?message=${encodeURIComponent("Tournoi créé en brouillon — il n'est pas encore visible publiquement.")}`,
  );
}
