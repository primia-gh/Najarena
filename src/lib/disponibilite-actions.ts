"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { messageRefusDisponibilite, SEUIL_A_LA_DEMANDE } from "@/lib/a-la-demande";

// Tournois à la demande (09/10/2026, idée en réserve n°11) : indiquer ou
// retirer une heure où l'on est disponible. Règles dans la base
// (declarer_disponibilite, retirer_disponibilite).

const PAGE = "/lol/a-la-demande";

function retour(type: "message" | "erreur", texte: string): never {
  redirect(`${PAGE}?${type}=${encodeURIComponent(texte)}#heures`);
}

export async function declarerDisponibilite(formData: FormData) {
  const debut = String(formData.get("debut") ?? "");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/connexion?suite=${encodeURIComponent(PAGE)}`);

  const { data: nombre, error } = await supabase.rpc("declarer_disponibilite", { p_debut: debut });
  if (error) retour("erreur", messageRefusDisponibilite(error.message));
  const n = nombre ?? 1;
  retour(
    "message",
    n >= SEUIL_A_LA_DEMANDE
      ? `C'est noté : ${n} joueurs sont disponibles à cette heure, le tournoi s'ouvre dans quelques minutes.`
      : `C'est noté : ${n} joueur${n > 1 ? "s" : ""} sur ${SEUIL_A_LA_DEMANDE}. Tu seras prévenu si le tournoi s'ouvre.`,
  );
}

export async function retirerDisponibilite(formData: FormData) {
  const debut = String(formData.get("debut") ?? "");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/connexion?suite=${encodeURIComponent(PAGE)}`);

  await supabase.rpc("retirer_disponibilite", { p_debut: debut });
  retour("message", "Disponibilité retirée.");
}
