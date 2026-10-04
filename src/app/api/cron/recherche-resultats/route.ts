import { NextResponse } from "next/server";
import { traiterRechercheResultats } from "@/lib/rapprochement";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { redigerRevuesAutomatiques } from "@/lib/revue-ia-serveur";

// Tâche planifiée (docs/moteur-resultats.md §6 — "Recherche de résultats",
// cadence cible 1 min). Vercel Cron ne descend pas sous 1 min même sur le
// plan Pro, et le plan Hobby (gratuit) refuse purement et simplement de
// déployer toute tâche planifiée plus fréquente qu'une fois par jour
// (échec au déploiement, pas une simple restriction silencieuse — vérifié
// dans la doc Vercel). vercel.json configure donc "une fois par jour" par
// défaut pour rester déployable sans compte payant ; le résultat reste
// correct dans tous les cas (on ne renonce qu'en latence, jamais en
// fiabilité — un vrai résultat Riot est retrouvé même avec un jour de
// retard, et à défaut le litige est ouvert comme prévu). Passer à un
// compte Pro pour retrouver une cadence proche de la cible (ex.
// "*/5 * * * *") une fois le site prêt à être utilisé en conditions
// réelles.
// Mise à jour du 24/09/2026 : sans attendre un compte Pro, la base appelle
// aussi cette route toutes les 5 minutes (pg_cron, tâche
// « najarena-recherche-resultats », voir docs/schema.sql) — indispensable
// pour qu'un tournoi du soir avance le soir même. Le passage quotidien de
// vercel.json reste en secours.
// Même mécanisme d'authentification que les autres routes /api/cron/*.
// Durée maximale d'une fonction sur le plan gratuit de Vercel : les séries
// Best-of et la recherche après litige demandent plus d'appels Riot.
export const maxDuration = 60;

export async function GET(request: Request) {
  const debut = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { erreur: "CRON_SECRET n'est pas configurée côté serveur." },
      { status: 503 },
    );
  }

  const autorisation = request.headers.get("authorization");
  if (autorisation !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const resultat = await traiterRechercheResultats();

  // Analyses détaillées automatiques de l'offre Elite (audit N25), dans le
  // temps qui reste : aucune n'est commencée au-delà de 45 s (limite de la
  // fonction : 60 s). Une panne de l'IA ne fait jamais échouer la tâche.
  const admin = creerClientAdmin();
  const revues = admin ? await redigerRevuesAutomatiques(admin, debut + 45_000).catch(() => null) : null;
  return NextResponse.json({ ...resultat, revues });
}
