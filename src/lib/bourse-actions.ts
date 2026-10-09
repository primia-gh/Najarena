"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { messageRefusBourse } from "@/lib/bourse-remplacants";

// Bourse aux remplaçants (09/10/2026, idée en réserve n°15). Toutes les
// règles sont dans la base (proposer_remplacement, quitter_remplacants,
// remplacer_aligne).

function retour(slug: string, type: "message" | "erreur", texte: string): never {
  redirect(
    `/lol/tournois/${encodeURIComponent(slug)}?${type === "erreur" ? "bourseErreur" : "bourse"}=${encodeURIComponent(texte)}#bourse`,
  );
}

async function connecte(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/connexion?suite=${encodeURIComponent(`/lol/tournois/${slug}`)}`);
  return { supabase, moi: data.user.id };
}

export async function proposerRemplacement(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const tournoi = String(formData.get("tournament_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const { supabase } = await connecte(slug);
  const { error } = await supabase.rpc("proposer_remplacement", { p_tournament_id: tournoi, p_role: role || undefined });
  if (error) retour(slug, "erreur", messageRefusBourse(error.message));
  retour(slug, "message", "C'est noté : les capitaines te voient dans la bourse. Tu seras prévenu si une équipe te prend.");
}

export async function quitterRemplacants(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const tournoi = String(formData.get("tournament_id") ?? "");
  const { supabase } = await connecte(slug);
  await supabase.rpc("quitter_remplacants", { p_tournament_id: tournoi });
  retour(slug, "message", "Tu n'es plus dans la bourse aux remplaçants.");
}

export async function remplacerAligne(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const tournoi = String(formData.get("tournament_id") ?? "");
  const sortant = String(formData.get("sortant") ?? "");
  const entrant = String(formData.get("entrant") ?? "");
  const { supabase } = await connecte(slug);

  const { error } = await supabase.rpc("remplacer_aligne", {
    p_tournament_id: tournoi,
    p_sortant: sortant,
    p_entrant: entrant,
  });
  if (error) retour(slug, "erreur", messageRefusBourse(error.message));

  const [{ data: t }, { data: inscription }] = await Promise.all([
    supabase.from("tournaments").select("nom").eq("id", tournoi).maybeSingle(),
    supabase.from("alignements").select("registration:registrations(equipe_nom)").eq("tournament_id", tournoi).eq("profile_id", entrant).maybeSingle(),
  ]);
  const equipe = inscription?.registration?.equipe_nom ?? "une équipe";
  const nomTournoi = t?.nom ?? "le tournoi";
  const lien = `${URL_SITE}/lol/tournois/${slug}`;
  after(() =>
    Promise.all([
      envoyerRappel(
        entrant,
        `Tu remplaces un joueur — ${nomTournoi}`,
        `${equipe} t'a pris dans son alignement pour ${nomTournoi}. Rejoins ton capitaine : ton compte Riot principal doit être dans la partie.`,
        lien,
      ),
      envoyerRappel(
        sortant,
        `Remplacé — ${nomTournoi}`,
        `Ton capitaine t'a remplacé dans l'alignement de ${equipe} pour ${nomTournoi}.`,
        lien,
      ),
    ]),
  );
  retour(slug, "message", "Remplacement enregistré : le remplaçant est prévenu.");
}
