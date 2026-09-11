import { NextResponse } from "next/server";
import { appliquerRotationSaisons } from "@/lib/classement-actions";

// Tâche planifiée mensuelle (docs/moteur-resultats.md §6 — "Rotation de
// saison"). Déclenchée par Vercel Cron (voir vercel.json à la racine).
// Même mécanisme d'authentification que /api/cron/decroissance-rd.
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

  const resultat = await appliquerRotationSaisons();
  return NextResponse.json(resultat);
}
