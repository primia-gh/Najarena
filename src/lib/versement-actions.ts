"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { URL_SITE } from "@/lib/notifications";
import { cashPrizesActifs, messageRefusDotation } from "@/lib/dotations";
import { codePaysVersement } from "@/lib/versements-stripe";
import { clientStripe } from "@/lib/versements-stripe-serveur";

// Compte de versement d'un gagnant (04/10/2026, audit N32) : ouvert chez
// Stripe (Connect Express), qui vérifie l'identité et les coordonnées
// bancaires sur ses propres pages. Najarena n'en garde que l'identifiant.

function versGains(type: "message" | "erreur", texte: string): never {
  redirect(`/moi/gains?${type}=${encodeURIComponent(texte)}`);
}

export async function ouvrirCompteVersement(formData: FormData) {
  if (!cashPrizesActifs()) redirect("/moi");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/connexion?suite=%2Fmoi%2Fgains");
  const moi = userData.user;

  const pays = codePaysVersement(String(formData.get("pays") ?? ""));
  if (!pays) versGains("erreur", "Choisis ton pays de résidence.");
  const stripe = clientStripe();
  const admin = creerClientAdmin();
  if (!stripe || !admin) versGains("erreur", "Le versement des gains n'est pas encore disponible.");

  const [{ data: existant }, { data: gains }] = await Promise.all([
    admin.from("comptes_versement").select("stripe_compte_id").eq("profile_id", moi.id).maybeSingle(),
    supabase.from("versements_dotation").select("tournament_id").eq("profile_id", moi.id).eq("statut", "a_verser").limit(1),
  ]);
  // Pas de compte Stripe ouvert pour rien (la base le revérifie).
  if (!existant && (gains ?? []).length === 0) versGains("erreur", "Aucun gain à recevoir pour l'instant.");

  const lien = await (async () => {
    try {
      let compteId = existant?.stripe_compte_id ?? null;
      if (!compteId) {
        const compte = await stripe.accounts.create(
          {
            type: "express",
            country: pays,
            email: moi.email,
            business_type: "individual",
            capabilities: { transfers: { requested: true } },
            metadata: { profile_id: moi.id },
          },
          { idempotencyKey: `compte-versement:${moi.id}:${pays}` },
        );
        // La base vérifie qu'il y a un gain à recevoir et rend le compte
        // déjà enregistré s'il en existe un (un seul par joueur).
        const { data: enregistre, error } = await admin.rpc("ouvrir_compte_versement", {
          p_profile_id: moi.id,
          p_stripe_compte_id: compte.id,
        });
        if (error || !enregistre) return { ok: false as const, message: messageRefusDotation(error?.message ?? "", "") };
        compteId = enregistre;
      }
      const lienStripe = await stripe.accountLinks.create({
        account: compteId,
        type: "account_onboarding",
        refresh_url: `${URL_SITE}/moi/gains?message=${encodeURIComponent("Le lien a expiré : recommence la vérification.")}`,
        return_url: `${URL_SITE}/moi/gains/retour`,
      });
      return { ok: true as const, url: lienStripe.url };
    } catch {
      return { ok: false as const, message: "" };
    }
  })();
  if (!lien.ok) versGains("erreur", lien.message || "Stripe est indisponible pour l'instant : réessaie plus tard.");
  redirect(lien.url);
}
