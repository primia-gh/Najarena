import { NextResponse } from "next/server";
import { appliquerDecroissanceInactivite } from "@/lib/classement-actions";

// Tâche planifiée mensuelle (docs/moteur-resultats.md §6 — "Décroissance
// d'inactivité"). Déclenchée par Vercel Cron (voir vercel.json à la racine).
// Vercel signe automatiquement ses requêtes cron avec l'en-tête Authorization
// ci-dessous quand la variable d'environnement CRON_SECRET est définie —
// sans elle, n'importe qui pourrait déclencher la tâche à volonté.
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

  const resultat = await appliquerDecroissanceInactivite();
  return NextResponse.json(resultat);
}
