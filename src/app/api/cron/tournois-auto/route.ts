import { NextResponse } from "next/server";
import { executerTournoisAuto } from "@/lib/tournois-auto/execution";
import { doitSynchroniserClash, synchroniserClash } from "@/lib/echeances-serveur";
import { apparierArene } from "@/lib/arene-serveur";

// Tournois automatiques (24/09/2026) : création des tournois quotidiens,
// ouverture du check-in, rappels, démarrage ou annulation — voir
// lib/tournois-auto/. Doit passer toutes les 5 minutes : le plan Hobby de
// Vercel refuse toute tâche planifiée plus fréquente qu'une fois par jour
// (voir recherche-resultats/route.ts), c'est donc la base de données qui
// appelle cette route (extension pg_cron de Supabase, gratuite — voir
// docs/schema.sql, section « Tournois automatiques »).
//
// ?simulation=1 : renvoie ce qui serait fait, sans rien modifier.
// Même mécanisme d'authentification que les autres routes /api/cron/*.
export const maxDuration = 60;

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

  const simulation = new URL(request.url).searchParams.get("simulation") === "1";
  const bilan = await executerTournoisAuto(simulation);
  // Calendrier Clash (audit N24) : quatre fois par jour, jamais bloquant.
  const clash =
    !simulation && doitSynchroniserClash(new Date()) ? await synchroniserClash().catch(() => null) : undefined;
  // Arène 1v1 (audit N19) : l'attente élargit l'écart toléré, on réessaie
  // donc d'apparier à chaque passage.
  const arene = simulation ? undefined : await apparierArene().catch(() => null);
  return NextResponse.json({ ...bilan, clash, arene }, { status: bilan.erreur ? 503 : 200 });
}
