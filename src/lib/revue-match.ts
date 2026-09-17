// Revue de match écrite (offre Elite) — comparaison à base de règles,
// jamais de texte généré librement : les chiffres viennent de Riot
// (stats_match_joueur, capturés gratuitement pendant le rapprochement,
// voir src/lib/rapprochement.ts), la phrase n'est qu'un calcul mis en
// mots. Cohérent avec "on n'invente jamais un résultat" (CLAUDE.md §3).

import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// En dessous de ce seuil, une moyenne ne veut rien dire — mieux vaut le
// dire clairement que de comparer sur un ou deux points de données.
const SEUIL_MIN_MATCHS = 3;

// Écart relatif en dessous duquel une différence est du bruit, pas un
// signal — évite de fabriquer un "leak" dans une partie propre.
const SEUIL_ECART_SIGNIFICATIF = 0.15;

export interface StatsMatch {
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  orGagne: number;
  dureeSecondes: number;
  gagne: boolean;
}

export interface Moyennes {
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  orGagne: number;
  nombreMatchs: number;
}

function moyenne(valeurs: number[]): number {
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

export async function chargerMoyennes(
  supabase: SupabaseServer,
  profileId: string,
): Promise<{ victoires: Moyennes | null; defaites: Moyennes | null }> {
  const { data } = await supabase
    .from("stats_match_joueur")
    .select("kills, deaths, assists, cs, or_gagne, gagne")
    .eq("profile_id", profileId);

  const lignes = data ?? [];
  const victoires = lignes.filter((l) => l.gagne);
  const defaites = lignes.filter((l) => !l.gagne);

  const construire = (groupe: typeof lignes): Moyennes | null => {
    if (groupe.length < SEUIL_MIN_MATCHS) return null;
    return {
      kills: moyenne(groupe.map((l) => l.kills)),
      deaths: moyenne(groupe.map((l) => l.deaths)),
      assists: moyenne(groupe.map((l) => l.assists)),
      cs: moyenne(groupe.map((l) => l.cs)),
      orGagne: moyenne(groupe.map((l) => l.or_gagne)),
      nombreMatchs: groupe.length,
    };
  };

  return { victoires: construire(victoires), defaites: construire(defaites) };
}

interface Ecart {
  libelle: string;
  relatif: number; // positif = plus mauvais que la moyenne victoire
  phrase: string;
}

// Compare chaque stat de ce match à la moyenne victoire du joueur et
// retient l'écart le plus marqué (le "leak"). Toujours par rapport aux
// victoires — "joue comme quand tu gagnes", jamais par rapport aux
// défaites, qui ne représentent pas un objectif.
export function genererRevue(match: StatsMatch, moyennesVictoires: Moyennes | null): string[] | null {
  if (!moyennesVictoires) return null;

  const ecarts: Ecart[] = [
    {
      libelle: "morts",
      relatif: (match.deaths - moyennesVictoires.deaths) / Math.max(1, moyennesVictoires.deaths),
      phrase: `Tu as fait plus de morts que dans tes victoires — ${match.deaths} contre une moyenne de ${moyennesVictoires.deaths.toFixed(1)}.`,
    },
    {
      libelle: "CS",
      relatif: (moyennesVictoires.cs - match.cs) / Math.max(1, moyennesVictoires.cs),
      phrase: `Ton CS est en retrait par rapport à tes victoires — ${match.cs} contre une moyenne de ${moyennesVictoires.cs.toFixed(0)}.`,
    },
    {
      libelle: "or",
      relatif: (moyennesVictoires.orGagne - match.orGagne) / Math.max(1, moyennesVictoires.orGagne),
      phrase: `Ton or gagné est en dessous de tes victoires — ${match.orGagne} contre une moyenne de ${moyennesVictoires.orGagne.toFixed(0)}.`,
    },
    {
      libelle: "participation aux kills",
      relatif:
        (moyennesVictoires.kills + moyennesVictoires.assists - (match.kills + match.assists)) /
        Math.max(1, moyennesVictoires.kills + moyennesVictoires.assists),
      phrase: `Ta participation aux kills est en retrait — ${match.kills + match.assists} (K+A) contre une moyenne de ${(moyennesVictoires.kills + moyennesVictoires.assists).toFixed(1)} dans tes victoires.`,
    },
  ];

  const pire = ecarts.reduce((a, b) => (b.relatif > a.relatif ? b : a));

  if (pire.relatif < SEUIL_ECART_SIGNIFICATIF) {
    return [
      match.gagne
        ? "Cette partie est représentative de ton niveau habituel en victoire — rien ne ressort particulièrement."
        : "Cette défaite ne s'explique pas par un écart de stats individuelles marqué par rapport à tes victoires — sans doute une dynamique d'équipe ou d'objectifs.",
    ];
  }

  return [pire.phrase];
}
