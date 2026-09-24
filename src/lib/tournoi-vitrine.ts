import { createClient } from "@/lib/supabase/server";

// Données d'affichage ajoutées par la refonte « Venin » de la page tournoi
// (design-system/najarena/pages/tournoi.md) : type de bracket, niveau
// requis, prise en compte au classement. Simple lecture de colonnes de
// `tournaments`, rangée ici pour laisser intact le chargement d'origine de
// lol/tournois/[slug]/page.tsx (chargerTournoi : inscriptions, matchs,
// verdicts, litiges).

const LABEL_BRACKET: Record<string, string> = {
  elim_simple: "Élimination directe",
};

export async function chargerComplementsTournoi(tournoiId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("type_bracket, rating_min, rating_max, compte_pour_classement")
    .eq("id", tournoiId)
    .maybeSingle();

  const min = data?.rating_min ?? null;
  const max = data?.rating_max ?? null;
  const niveau =
    min !== null && max !== null
      ? `${min} – ${max}`
      : min !== null
        ? `${min} et plus`
        : max !== null
          ? `Jusqu'à ${max}`
          : "Ouvert à tous";

  return {
    typeBracket: data ? (LABEL_BRACKET[data.type_bracket] ?? data.type_bracket) : null,
    niveau,
    comptePourClassement: data?.compte_pour_classement ?? true,
  };
}
