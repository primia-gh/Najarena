import { NextResponse } from "next/server";
import { traiterRechercheResultats } from "@/lib/rapprochement";

// Tâche planifiée (docs/moteur-resultats.md §6 — "Recherche de résultats",
// cadence cible 1 min). Vercel Cron ne descend pas sous 1 min en pratique
// (et le plan Hobby restreint fortement la fréquence des tâches planifiées
// à un déclenchement par jour) — voir vercel.json pour la cadence
// réellement configurée, et le mémo du projet pour le compromis retenu.
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
