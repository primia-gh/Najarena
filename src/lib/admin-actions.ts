"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifierJoueur, URL_SITE } from "@/lib/notifications";

async function verifierAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/moi");
  }

  return userData.user;
}

export async function resoudreLitigeAdmin(formData: FormData) {
  const disputeId = String(formData.get("dispute_id") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();

  const supabase = await createClient();
  const utilisateur = await verifierAdmin(supabase);

  if (!resolution) {
    redirect(`/admin?erreur=${encodeURIComponent("La résolution ne peut pas être vide.")}`);
  }

  const { data: litige } = await supabase
    .from("disputes")
    .update({ resolution, resolu_par: utilisateur.id, resolu_le: new Date().toISOString() })
    .eq("id", disputeId)
    .select("ouvert_par, match:matches(tournament:tournaments(nom, slug))")
    .maybeSingle();

  if (litige?.match?.tournament) {
    await notifierJoueur(
      litige.ouvert_par,
      `Litige résolu — ${litige.match.tournament.nom}`,
      "Un administrateur a répondu à ton litige",
      `<p>Résolution : ${resolution}</p>
       <p><a href="${URL_SITE}/lol/tournois/${litige.match.tournament.slug}">Voir le tournoi</a></p>`,
    );
  }

  redirect("/admin");
}
