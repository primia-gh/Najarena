"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { envoyerRappel, URL_SITE } from "@/lib/notifications";
import { DELAI_PRESENCE_MINUTES, messageRefusDivision } from "@/lib/divisions";

// Divisions mensuelles (09/10/2026, idée en réserve n°13) : s'inscrire au
// mois suivant, et « Je suis là » pour lancer un match de poule. Règles
// dans la base (s_inscrire_division, quitter_division, je_suis_la_division).

const PAGE = "/lol/divisions";

function retour(type: "message" | "erreur", texte: string, ancre = "inscription"): never {
  redirect(`${PAGE}?${type}=${encodeURIComponent(texte)}#${ancre}`);
}

async function connecte() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/connexion?suite=${encodeURIComponent(PAGE)}`);
  return { supabase, moi: data.user.id };
}

export async function sInscrireDivision() {
  const { supabase } = await connecte();
  const { error } = await supabase.rpc("s_inscrire_division");
  if (error) retour("erreur", messageRefusDivision(error.message));
  retour("message", "Inscrit à la prochaine ligue : ta poule te sera annoncée le premier lundi du mois.");
}

export async function quitterDivision() {
  const { supabase } = await connecte();
  await supabase.rpc("quitter_division");
  retour("message", "Désinscrit de la prochaine ligue.");
}

export async function jeSuisLa(formData: FormData) {
  const rencontre = String(formData.get("rencontre") ?? "");
  const { supabase, moi } = await connecte();

  const { data: slug, error } = await supabase.rpc("je_suis_la_division", { p_rencontre_id: rencontre });
  if (error) retour("erreur", messageRefusDivision(error.message), "ma-poule");

  const { data: r } = await supabase
    .from("rencontres_division")
    .select("joueur_a, joueur_b")
    .eq("id", rencontre)
    .maybeSingle();
  const adversaire = r ? (r.joueur_a === moi ? r.joueur_b : r.joueur_a) : null;
  const { data: profil } = await supabase.from("profiles").select("pseudo").eq("id", moi).maybeSingle();
  const pseudo = profil?.pseudo ?? "Ton adversaire";

  if (slug) {
    if (adversaire) {
      after(() =>
        envoyerRappel(
          adversaire,
          "Match de division lancé",
          `${pseudo} est là aussi : votre match est lancé. Rejoins la salle de match et clique « Je suis prêt ».`,
          `${URL_SITE}/lol/tournois/${slug}#ton-match`,
        ),
      );
    }
    redirect(`/lol/tournois/${slug}#ton-match`);
  }
  if (adversaire) {
    after(() =>
      envoyerRappel(
        adversaire,
        "Ton adversaire de division est là",
        `${pseudo} est disponible pour votre match de division : clique « Je suis là » dans les ${DELAI_PRESENCE_MINUTES} minutes pour le lancer.`,
        `${URL_SITE}${PAGE}#ma-poule`,
      ),
    );
  }
  retour(
    "message",
    `C'est noté : ton adversaire est prévenu. Le match se lance dès qu'il clique aussi (dans les ${DELAI_PRESENCE_MINUTES} minutes).`,
    "ma-poule",
  );
}
