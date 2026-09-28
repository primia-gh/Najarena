import { createClient } from "@/lib/supabase/server";
import { construireIcs } from "@/lib/agenda";
import { URL_SITE } from "@/lib/notifications";
import { heureParis } from "@/lib/tournois-auto/creneaux";

// « Ajouter à mon agenda » (28/09/2026, audit N6) : fichier calendrier du
// tournoi, à l'heure réelle (UTC dans le fichier, chaque agenda l'affiche
// dans le fuseau de son propriétaire).
export async function GET(_requete: Request, ctx: RouteContext<"/lol/tournois/[slug]/agenda">) {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, nom, slug, format, region, debute_le, checkin_ouvre_le, statut")
    .eq("slug", slug)
    .maybeSingle();

  if (!t || t.statut === "brouillon") {
    return new Response("Tournoi introuvable.", { status: 404 });
  }

  const lien = `${URL_SITE}/lol/tournois/${t.slug}`;
  const ics = construireIcs({
    uid: `tournoi-${t.id}@najarena`,
    titre: `${t.nom} — Najarena`,
    debut: new Date(t.debute_le),
    dureeMinutes: 150,
    description: `Tournoi League of Legends ${t.format}, ${t.region}. Check-in à partir de ${heureParis(t.checkin_ouvre_le)} (heure de Paris) : sans check-in, pas de place dans le bracket. ${lien}`,
    url: lien,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t.slug}.ics"`,
    },
  });
}
