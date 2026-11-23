import { NextResponse } from "next/server";
import Stripe from "stripe";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { verifierAbonnementsStripe } from "@/lib/abonnements-stripe-serveur";

// Vérification quotidienne des abonnements (23/11/2026) : relit chez Stripe
// les abonnements de chaque client et corrige l'offre si un message du
// webhook s'est perdu (offre retirée à un abonnement impayé ou résilié,
// accordée à un abonnement payé, premier abonnement compris). Déclenchée chaque jour par
// Vercel Cron (vercel.json), même authentification que les autres routes
// /api/cron/*. Sans Stripe, ne fait rien.
export const maxDuration = 60;

export async function GET(request: Request) {
  const debut = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ erreur: "CRON_SECRET n'est pas configurée côté serveur." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }
  const cleSecrete = process.env.STRIPE_SECRET_KEY;
  if (!cleSecrete) {
    return NextResponse.json({ actif: false, raison: "Stripe pas encore activé." });
  }
  const admin = creerClientAdmin();
  if (!admin) {
    return NextResponse.json({ erreur: "Client serveur Supabase indisponible." }, { status: 503 });
  }

  // Aucun travail commencé au-delà de 30 s (limite de la fonction : 60 s ;
  // un joueur peut encore demander deux appels de 10 s à Stripe).
  // Un appel bloqué chez Stripe ne doit pas dépasser la limite de la
  // fonction : 10 s par appel, une seule nouvelle tentative.
  const client = new Stripe(cleSecrete, { timeout: 10_000, maxNetworkRetries: 1 });
  const bilan = await verifierAbonnementsStripe(client, admin, { finAu: debut + 30_000 });
  // Toute correction ou anomalie apparaît dans le journal d'erreurs de
  // Vercel (jamais sur le salon Discord public des annonces).
  // Une vérification qui ne tourne plus doit se voir (sauf avant le réglage
  // des prix, quand il n'y a rien à vérifier).
  if (!bilan.actif && !bilan.raison.startsWith("Aucun prix")) {
    console.error(`Vérification des abonnements Stripe impossible : ${bilan.raison}`);
  }
  if (bilan.actif && bilan.restants) {
    console.error("Vérification des abonnements Stripe : heure limite atteinte, la suite au prochain passage.");
  }
  if (bilan.actif && bilan.accordees + bilan.retirees + bilan.signales + bilan.erreurs > 0) {
    console.error(
      `Vérification des abonnements Stripe : ${bilan.examines} relus, ${bilan.retirees} offre(s) retirée(s), ` +
        `${bilan.accordees} accordée(s), ${bilan.signales} cas à regarder, ${bilan.erreurs} sans réponse.`,
    );
  }
  return NextResponse.json(bilan);
}
