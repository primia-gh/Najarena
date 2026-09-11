"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifierJoueur, URL_SITE } from "@/lib/notifications";

export async function ouvrirLitige(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  if (!motif) {
    redirect(
      `/lol/tournois/${slug}?erreur=${encodeURIComponent("Un motif est obligatoire pour signaler un litige.")}`,
    );
  }

  // La policy RLS "un participant ouvre un litige" revérifie elle-même que
  // l'appelant fait partie de ce match — aucun contrôle de confiance ici.
  const { error } = await supabase.from("disputes").insert({
    match_id: matchId,
    ouvert_par: userData.user.id,
    motif,
  });

  if (error) {
    redirect(
      `/lol/tournois/${slug}?erreur=${encodeURIComponent("Impossible d'enregistrer ce litige pour l'instant.")}`,
    );
  }

  const { data: t } = await supabase
    .from("tournaments")
    .select("nom, organisateur_id")
    .eq("slug", slug)
    .maybeSingle();

  if (t) {
    await notifierJoueur(
      t.organisateur_id,
      `Nouveau litige — ${t.nom}`,
      "Un joueur a signalé un litige",
      `<p>Motif : ${motif}</p>
       <p><a href="${URL_SITE}/moi">Voir mon tableau de bord</a></p>`,
    );
  }

  redirect(
    `/lol/tournois/${slug}?message=${encodeURIComponent("Litige signalé — l'organisateur va l'examiner.")}`,
  );
}
