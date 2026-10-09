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

export async function demanderCoaching(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const coach = String(formData.get("coach") ?? "");
  const { supabase, moi } = await connecte(slug);
  const { error } = await supabase.rpc("demander_coaching", { p_coach: coach });
  if (error) retour(slug, "erreur", messageRefusCoach(error.message));

  const eleve = await pseudoDe(supabase, moi);
  after(() =>
    envoyerRappel(
      coach,
      "Demande de suivi",
      `${eleve?.pseudo ?? "Un joueur"} te demande de le suivre comme coach. Accepte ou refuse depuis ton CV.`,
      `${URL_SITE}/joueur/${slug}#coach`,
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
        `${URL_SITE}/joueur/${slug}#coach`,
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
  await supabase.rpc("terminer_coaching", { p_coaching_id: coaching });
  retour(
    slug,
    "message",
    demande ? "Demande annulée." : "Suivi terminé : sa progression reste affichée, arrêtée à aujourd'hui.",
  );
}
