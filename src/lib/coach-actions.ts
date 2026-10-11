"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { messageRefusCoach } from "@/lib/coach";

// Coach vérifié (09/10/2026, idée en réserve n°8) : demander, accepter ou
// refuser, terminer un suivi. Règles dans la base (demander_coaching,
// repondre_coaching, terminer_coaching).

function retour(slug: string, type: "message" | "erreur", texte: string): never {
  redirect(
    `/joueur/${encodeURIComponent(slug)}?${type === "erreur" ? "coachErreur" : "coach"}=${encodeURIComponent(texte)}#coach`,
  );
}

async function connecte(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/connexion?suite=${encodeURIComponent(`/joueur/${slug}`)}`);
  return { supabase, moi: data.user.id };
}

async function pseudoDe(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("profiles").select("pseudo, slug").eq("id", id).maybeSingle();
  return data;
}

// La case « J'accepte des élèves » (décochée par défaut, 11/10/2026).
export async function reglerEleves(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const accepte = formData.get("accepte") === "1";
  const { supabase } = await connecte(slug);
  const { error } = await supabase.rpc("regler_eleves", { p_accepte: accepte });
  if (error) {
    retour(
      slug,
      "erreur",
      error.message.includes("COACH_NON_ELIGIBLE")
        ? "Tu n'es pas (ou plus) classé Diamant Najarena : cette case ne se coche pas pour l'instant."
        : messageRefusCoach(error.message),
    );
  }
  retour(
    slug,
    "message",
    accepte
      ? "C'est noté : ton CV affiche « Coach vérifié » et les joueurs peuvent te demander un suivi."
      : "C'est noté : plus de nouvelle demande. Tes suivis en cours continuent et leur progression reste visible.",
  );
}

export async function demanderCoaching(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const coach = String(formData.get("coach") ?? "");
  const { supabase, moi } = await connecte(slug);
  const { error } = await supabase.rpc("demander_coaching", { p_coach: coach });
  if (error) retour(slug, "erreur", messageRefusCoach(error.message));

  // Adresse du CV relue en base, jamais celle du formulaire.
  const [eleve, profilCoach] = await Promise.all([pseudoDe(supabase, moi), pseudoDe(supabase, coach)]);
  after(() =>
    envoyerRappel(
      coach,
      "Demande de suivi",
      `${eleve?.pseudo ?? "Un joueur"} te demande de le suivre comme coach. Accepte ou refuse depuis ton CV.`,
      profilCoach ? `${URL_SITE}/joueur/${profilCoach.slug}#coach` : URL_SITE,
    ),
  );
  retour(slug, "message", "Demande envoyée : le coach est prévenu.");
}

export async function repondreCoaching(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const coaching = String(formData.get("coaching") ?? "");
  const accepter = formData.get("accepter") === "1";
  const { supabase, moi } = await connecte(slug);

  const { data: ligne } = await supabase.from("coachings").select("eleve_id").eq("id", coaching).maybeSingle();
  const { error } = await supabase.rpc("repondre_coaching", { p_coaching_id: coaching, p_accepter: accepter });
  if (error) retour(slug, "erreur", messageRefusCoach(error.message));

  if (ligne) {
    const coach = await pseudoDe(supabase, moi);
    after(() =>
      envoyerRappel(
        ligne.eleve_id,
        accepter ? "Suivi accepté" : "Suivi refusé",
        accepter
          ? `${coach?.pseudo ?? "Ton coach"} a accepté de te suivre : ta progression en tournoi s'affiche désormais sur son CV.`
          : `${coach?.pseudo ?? "Le coach"} n'a pas accepté ta demande de suivi.`,
        coach ? `${URL_SITE}/joueur/${coach.slug}#coach` : URL_SITE,
      ),
    );
  }
  retour(slug, "message", accepter ? "Suivi commencé." : "Demande refusée.");
}

export async function terminerCoaching(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const coaching = String(formData.get("coaching") ?? "");
  const demande = formData.get("demande") === "1";
  const { supabase } = await connecte(slug);
  const { data: fait, error } = await supabase.rpc("terminer_coaching", { p_coaching_id: coaching });
  if (error || !fait) retour(slug, "erreur", "Ce suivi n'est plus en cours : rien à terminer.");
  retour(
    slug,
    "message",
    demande ? "Demande annulée." : "Suivi terminé : sa progression reste affichée, arrêtée à aujourd'hui.",
  );
}
