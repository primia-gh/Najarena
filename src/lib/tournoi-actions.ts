"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugifier } from "@/lib/slug";
import { notifierDiscord, URL_SITE } from "@/lib/notifications";
import { formaterDate } from "@/lib/tournois";
import { chargerOffre } from "@/lib/offres";

const CAPACITES = [4, 8, 16, 32, 64] as const;
const CAPACITE_ETENDUE = 128;
const BEST_OF_PREMIUM = [3, 5] as const;

export async function creerTournoi(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const nom = String(formData.get("nom") ?? "").trim();
  const capacite = Number(formData.get("capacite"));
  const bestOf = Number(formData.get("best_of") ?? 1);
  const region = String(formData.get("region") ?? "");
  const debuteLeBrut = String(formData.get("debute_le") ?? "");
  const checkinOuvreLeBrut = String(formData.get("checkin_ouvre_le") ?? "");
  const publier = formData.get("statut_initial") === "ouvert";

  if (nom.length < 3 || nom.length > 60) {
    redirect(
      `/organiser/nouveau?erreur=${encodeURIComponent("Le nom doit faire entre 3 et 60 caractères.")}`,
    );
  }

  // Capacité 128 et Best-of 3/5 réservés à l'offre "organisateur" — vérifié
  // ici, pas seulement caché côté formulaire : un appel direct à cette
  // action avec des valeurs forcées doit être rejeté de la même façon.
  const { offre } = await chargerOffre(supabase, userData.user.id);
  const estOrganisateurPremium = offre === "organisateur";

  const capacitesAutorisees: number[] = estOrganisateurPremium
    ? [...CAPACITES, CAPACITE_ETENDUE]
    : [...CAPACITES];
  if (!capacitesAutorisees.includes(capacite)) {
    redirect(`/organiser/nouveau?erreur=${encodeURIComponent("Capacité invalide.")}`);
  }

  const bestOfAutorises: number[] = estOrganisateurPremium ? [1, ...BEST_OF_PREMIUM] : [1];
  if (!bestOfAutorises.includes(bestOf)) {
    redirect(`/organiser/nouveau?erreur=${encodeURIComponent("Format Best-of invalide.")}`);
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

  const slug = `${slugifier(nom)}-${Math.random().toString(36).slice(2, 7)}`;

  // game_id=1 est LoL — seule ligne de `games` en V1 (voir docs/design-system.md
  // et le correctif du 13/09/2026 sur l'accueil) : pas besoin de résoudre
  // l'id depuis un slug.
  //
  // Sans season_id, la clôture d'un tournoi n'écrit rien dans ratings
  // (cloturerTournoi) : on rattache donc chaque tournoi à la saison courante.
  // Nul si aucune saison n'est courante — cloturerTournoi retente alors.
  const { data: saisonCourante } = await supabase
    .from("seasons")
    .select("id")
    .eq("game_id", 1)
    .eq("est_courante", true)
    .maybeSingle();

  const { error } = await supabase.from("tournaments").insert({
    game_id: 1,
    season_id: saisonCourante?.id ?? null,
    organisateur_id: userData.user.id,
    slug,
    nom,
    format: "1v1",
    capacite,
    best_of: bestOf,
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
