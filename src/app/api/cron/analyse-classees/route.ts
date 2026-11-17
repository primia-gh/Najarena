import { NextResponse } from "next/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { budgetAppels } from "@/lib/analyse-classees";
import { lireClassees } from "@/lib/analyse-classees-serveur";
import { envoyerBilansHebdo } from "@/lib/bilan-hebdo-serveur";

// Tâche planifiée du bilan du joueur, étape 2 (05/10/2026) : lit chez Riot
// les parties classées des joueurs qui l'ont demandé, puis, le lundi, envoie
// le bilan de la semaine sur Discord. Appelée toutes les
// 5 minutes par la base (pg_cron, tâche « najarena-analyse-classees »,
// docs/schema.sql), décalée de 2 minutes sur la recherche des résultats de
// tournoi. Même authentification que les autres routes /api/cron/*.
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
  const admin = creerClientAdmin();
  if (!admin) {
    return NextResponse.json({ erreur: "Client serveur Supabase indisponible." }, { status: 503 });
  }

  // Aucun appel Riot commencé au-delà de 40 s (limite de la fonction : 60 s).
  const lecture = await lireClassees(admin, {
    budget: budgetAppels(process.env.ANALYSE_APPELS_PAR_PASSAGE),
    finAu: debut + 40_000,
  });
  // Bilans de la semaine, dans le temps qui reste : une panne de Discord ne
  // fait jamais échouer la tâche.
  const bilans = await envoyerBilansHebdo(admin, new Date(), debut + 50_000).catch(() => []);
  return NextResponse.json({ lecture, bilans });
}
