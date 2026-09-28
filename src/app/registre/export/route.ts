import { NextResponse } from "next/server";
import { creerClientPublic } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/types";

// Registre des points complet, tel qu'il est scellé (audit N8) : de quoi
// refaire soi-même le calcul des empreintes avec
// scripts/verifier-registre.mjs, sans faire confiance au site.
type LigneRegistre = Database["public"]["Views"]["registre_public"]["Row"];

const PAGE = 1000;

export async function GET() {
  const supabase = creerClientPublic();
  const lignes: LigneRegistre[] = [];

  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase
      .from("registre_public")
      .select("*")
      .order("numero", { ascending: true })
      .range(debut, debut + PAGE - 1);
    if (error) {
      return NextResponse.json({ erreur: "Registre indisponible pour l'instant." }, { status: 503 });
    }
    lignes.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  return NextResponse.json(
    {
      genere_le: new Date().toISOString(),
      verification: "node verifier-registre.mjs <adresse de cette page>",
      lignes,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
