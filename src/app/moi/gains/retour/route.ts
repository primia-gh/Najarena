import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { cashPrizesActifs } from "@/lib/dotations";
import { compteStripeVerifie } from "@/lib/versements-stripe";
import { clientStripe } from "@/lib/versements-stripe-serveur";

// Retour de la vérification d'identité chez Stripe (audit N32) : l'état du
// compte est relu chez Stripe (jamais déduit de l'adresse de retour), puis
// enregistré. Le webhook account.updated fait de même pour les changements
// ultérieurs. Relire et enregistrer deux fois ne change rien.
export async function GET(request: Request) {
  const vers = (texte: string, type: "message" | "erreur" = "message") =>
    NextResponse.redirect(new URL(`/moi/gains?${type}=${encodeURIComponent(texte)}`, request.url));
  if (!cashPrizesActifs()) return NextResponse.redirect(new URL("/moi", request.url));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.redirect(new URL("/connexion?suite=%2Fmoi%2Fgains", request.url));

  const stripe = clientStripe();
  const admin = creerClientAdmin();
  if (!stripe || !admin) return vers("Le versement des gains n'est pas encore disponible.", "erreur");

  const { data: compte } = await admin
    .from("comptes_versement")
    .select("stripe_compte_id")
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!compte) return vers("Aucun compte de versement ouvert.", "erreur");

  try {
    const etat = await stripe.accounts.retrieve(compte.stripe_compte_id);
    const verifie = compteStripeVerifie(etat);
    await admin.rpc("maj_compte_versement", { p_stripe_compte_id: compte.stripe_compte_id, p_verifie: verifie });
    return vers(
      verifie
        ? "Identité vérifiée par Stripe : ton gain te sera versé par un administrateur."
        : "Vérification incomplète ou en cours chez Stripe : reprends-la si Stripe te le demande.",
    );
  } catch {
    return vers("Stripe est indisponible pour l'instant : l'état de ta vérification sera mis à jour plus tard.", "erreur");
  }
}
