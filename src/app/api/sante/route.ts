import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Point de santé (audit C1) : un service de surveillance gratuit (UptimeRobot,
// Better Stack…) l'appelle toutes les 5 minutes et prévient par e-mail s'il
// ne répond pas 200. Vérifie que la base répond (une base Supabase mise en
// pause rend le site vide sans erreur visible). Ne renvoie rien d'autre
// qu'un état : aucune donnée, aucun secret.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("seasons").select("id").limit(1);
  const entetes = { "Cache-Control": "no-store" };
  if (error) {
    return NextResponse.json({ site: "ok", base: "injoignable" }, { status: 503, headers: entetes });
  }
  return NextResponse.json({ site: "ok", base: "ok" }, { headers: entetes });
}
