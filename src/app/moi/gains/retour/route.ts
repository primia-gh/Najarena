import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { cashPrizesActifs } from "@/lib/dotations";
import { compteStripeVerifie } from "@/lib/versements-stripe";
import { clientStripe } from "@/lib/versements-stripe-serveur";
import { RETOURS_EXTERNES } from "@/lib/messages-adresse";

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
  if (!stripe || !admin) return vers(RETOURS_EXTERNES.versementIndisponible, "erreur");

  const { data: compte } = await admin
    .from("comptes_versement")
    .select("stripe_compte_id")
    .eq("profile_id", userData.user.id)
    .maybeSingle();
  if (!compte) return vers(RETOURS_EXTERNES.aucunCompteVersement, "erreur");

  try {
    const etat = await stripe.accounts.retrieve(compte.stripe_compte_id);
    const verifie = compteStripeVerifie(etat);
    await admin.rpc("maj_compte_versement", { p_stripe_compte_id: compte.stripe_compte_id, p_verifie: verifie });
    return vers(
      verifie ? RETOURS_EXTERNES.identiteVerifiee : RETOURS_EXTERNES.verificationIncomplete,
    );
  } catch {
    return vers(RETOURS_EXTERNES.stripeIndisponible, "erreur");
  }
}
