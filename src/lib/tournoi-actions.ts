"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugifier } from "@/lib/slug";
import { notifierDiscord, URL_SITE } from "@/lib/notifications";
import { formaterDate } from "@/lib/tournois";
import { chargerOffre } from "@/lib/offres";
import { instantDepuisSaisieParis } from "@/lib/tournois-auto/creneaux";
import { echapperDiscord } from "@/lib/echappement";
import { messageModeration } from "@/lib/moderation";
import { REGIONS } from "@/lib/regions";

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
  // Tournoi amical (audit N12) : aucun point de classement en jeu, choix
  // figé à la création comme les autres réglages.
  const amical = formData.get("amical") === "oui";
  // Format (audit N21) : 5v5 = inscription par équipe, toujours jusqu'au
  // Nexus et hors classement individuel (la base l'exige aussi).
  const format = formData.get("format") === "5v5" ? "5v5" : "1v1";
  // Condition de victoire (audit N5) : Nexus par défaut, 1v1 classique au choix.
  const condition = format === "1v1" && formData.get("condition_victoire") === "classique" ? "classique" : "nexus";
  // Communauté (audit N30) : la base vérifie que l'organisateur en est le
  // fondateur ou un administrateur.
  const communauteId = String(formData.get("communaute_id") ?? "");

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

  // Un code de serveur connu, pas un texte libre : la région part telle
  // quelle sur le Discord officiel (audit sécurité du 10/10/2026, M6 ; la
  // base l'exige aussi, contrainte tournaments_region_check).
  if (!REGIONS.some((r) => r.code === region)) {
    redirect(`/organiser/nouveau?erreur=${encodeURIComponent("Choisis une région.")}`);
  }

  // Heures saisies = heure de Paris (le serveur tourne en UTC : lues telles
  // quelles, « 20:00 » devenait un tournoi à 22h00 l'été).
  const debuteLe = instantDepuisSaisieParis(debuteLeBrut);
  const checkinOuvreLe = instantDepuisSaisieParis(checkinOuvreLeBrut);

  if (!debuteLe || !checkinOuvreLe) {
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
    format,
    capacite,
    best_of: bestOf,
    region,
    debute_le: debuteLe.toISOString(),
    checkin_ouvre_le: checkinOuvreLe.toISOString(),
    statut: publier ? "ouvert" : "brouillon",
    compte_pour_classement: format === "1v1" && !amical,
    condition_victoire: condition,
    communaute_id: /^[0-9a-f-]{36}$/.test(communauteId) ? communauteId : null,
  });

  if (error) {
    redirect(
      `/organiser/nouveau?erreur=${encodeURIComponent(
        error.message.includes("COMMUNAUTE_INTERDITE")
          ? "Seuls le fondateur et les administrateurs publient des tournois dans cette communauté."
          : (messageModeration(error.message) ?? "Impossible de créer le tournoi pour l'instant."),
      )}`,
    );
  }

  if (publier) {
    await notifierDiscord(
      `📣 Nouveau tournoi ${format} ouvert — **${echapperDiscord(nom)}** (${capacite} ${format === "5v5" ? "équipes" : "joueurs"}, ${echapperDiscord(region)}), débute le ${formaterDate(debuteLe.toISOString())}.\n${URL_SITE}/lol/tournois/${slug}`,
    );
    redirect(`/lol/tournois/${slug}`);
  }

  redirect(
    `/moi?message=${encodeURIComponent("Tournoi créé en brouillon — il n'est pas encore visible publiquement.")}`,
  );
}
