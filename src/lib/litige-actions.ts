"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifierJoueur, URL_SITE } from "@/lib/notifications";
import { echapperHtml } from "@/lib/echappement";
import { messageModeration } from "@/lib/moderation";

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
    // Un seul litige ouvert par joueur et par match (audit sécurité du
    // 10/10/2026, M4 : index unique en base).
    const message = error.message.includes("disputes_un_ouvert_par_joueur_et_match")
      ? "Tu as déjà un litige ouvert sur ce match : l'organisateur va l'examiner."
      : (messageModeration(error.message) ?? "Impossible d'enregistrer ce litige pour l'instant.");
    redirect(`/lol/tournois/${slug}?erreur=${encodeURIComponent(message)}`);
  }

  // L'organisateur prévenu est celui du tournoi du match, pas celui du slug
  // envoyé par le formulaire (sinon le motif partait chez n'importe quel
  // organisateur).
  const { data: matchLitige } = await supabase
    .from("matches")
    .select("tournament:tournaments(nom, organisateur_id)")
    .eq("id", matchId)
    .maybeSingle();
  const t = matchLitige?.tournament;

  if (t) {
    await notifierJoueur(
      t.organisateur_id,
      `Nouveau litige — ${t.nom}`,
      "Un joueur a signalé un litige",
      `<p>Motif : ${echapperHtml(motif)}</p>
       <p><a href="${URL_SITE}/moi">Voir mon tableau de bord</a></p>`,
    );
  }

  redirect(
    `/lol/tournois/${slug}?message=${encodeURIComponent("Litige signalé — l'organisateur va l'examiner.")}`,
  );
}
