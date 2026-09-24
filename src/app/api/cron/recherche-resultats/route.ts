import { NextResponse } from "next/server";
import { traiterRechercheResultats } from "@/lib/rapprochement";

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
export async function GET(request: Request) {
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
  return NextResponse.json(resultat);
}
