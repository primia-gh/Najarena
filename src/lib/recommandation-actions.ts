"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { messageRefusRecommandation } from "@/lib/recommandations";

// Recommandations vérifiées (09/10/2026, idée en réserve n°7) : écrire,
// retirer, masquer. Toutes les règles sont dans la base (recommander,
// retirer_recommandation, masquer_recommandation).

function retour(slug: string, type: "message" | "erreur", texte: string): never {
  redirect(
    `/joueur/${encodeURIComponent(slug)}?${type === "erreur" ? "recoErreur" : "reco"}=${encodeURIComponent(texte)}#recommandations`,
  );
}

async function connecte(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/connexion?suite=${encodeURIComponent(`/joueur/${slug}`)}`);
  return { supabase, moi: data.user.id };
}

export async function recommanderJoueur(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const destinataire = String(formData.get("destinataire") ?? "");
  const texte = String(formData.get("texte") ?? "");
  const { supabase, moi } = await connecte(slug);

  const { data: existante } = await supabase
    .from("recommandations")
    .select("auteur_id")
    .eq("auteur_id", moi)
    .eq("destinataire_id", destinataire)
    .maybeSingle();
  // La base dit si c'est la première recommandation de cette paire : le
  // joueur n'est prévenu qu'une fois par auteur, même après un retrait.
  const { data: premiere, error } = await supabase.rpc("recommander", { p_destinataire: destinataire, p_texte: texte });
  if (error) retour(slug, "erreur", messageRefusRecommandation(error.message));

  if (premiere) {
    // Pseudo et adresse du CV relus en base, jamais ceux du formulaire.
    const [{ data: auteur }, { data: cible }] = await Promise.all([
      supabase.from("profiles").select("pseudo").eq("id", moi).maybeSingle(),
      supabase.from("profiles").select("slug").eq("id", destinataire).maybeSingle(),
    ]);
    after(() =>
      envoyerRappel(
        destinataire,
        "Nouvelle recommandation",
        `${auteur?.pseudo ?? "Un joueur"} t'a recommandé sur ton CV Najarena. Tu peux la masquer si tu ne veux pas l'afficher.`,
        cible ? `${URL_SITE}/joueur/${cible.slug}#recommandations` : URL_SITE,
      ),
    );
  }
  retour(slug, "message", existante ? "Recommandation modifiée." : "Recommandation publiée sur son CV.");
}

export async function retirerRecommandation(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const destinataire = String(formData.get("destinataire") ?? "");
  const { supabase } = await connecte(slug);
  const { error } = await supabase.rpc("retirer_recommandation", { p_destinataire: destinataire });
  if (error) retour(slug, "erreur", messageRefusRecommandation(error.message));
  retour(slug, "message", "Recommandation retirée.");
}

export async function masquerRecommandation(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const auteur = String(formData.get("auteur") ?? "");
  const masquee = formData.get("masquee") === "1";
  const { supabase } = await connecte(slug);
  const { data: fait, error } = await supabase.rpc("masquer_recommandation", { p_auteur: auteur, p_masquee: masquee });
  if (error || !fait) retour(slug, "erreur", "Cette recommandation n'existe plus.");
  retour(slug, "message", masquee ? "Recommandation masquée de ton CV." : "Recommandation de nouveau affichée.");
}
