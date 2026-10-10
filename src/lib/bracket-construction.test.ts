import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { construireBracket, ordonnerParRating } from "./bracket-construction";

describe("ordonnerParRating", () => {
  it("meilleur rating en tête de série, joueurs sans rating à la fin", () => {
    const ordre = ordonnerParRating([
      { profileId: "bronze", rating: 1280 },
      { profileId: "nouveau", rating: null },
      { profileId: "diamant", rating: 1790 },
      { profileId: "or", rating: 1500 },
    ]);
    expect(ordre).toEqual(["diamant", "or", "bronze", "nouveau"]);
  });

  it("à égalité, l'ordre vient du tirage au sort (plus de placement figé)", () => {
    const joueurs = [
      { profileId: "a", rating: null },
      { profileId: "b", rating: null },
      { profileId: "c", rating: null },
    ];
    const ordres = new Set(
      [0, 0.34, 0.67, 0.99].map((x) => ordonnerParRating(joueurs, () => x).join(",")),
    );
    expect(ordres.size).toBeGreaterThan(1);
  });

  it("n'oublie ni ne duplique aucun joueur", () => {
    const joueurs = Array.from({ length: 16 }, (_, i) => ({
      profileId: `j${i}`,
      rating: i % 3 === 0 ? null : 1300 + i * 25,
    }));
    const ordre = ordonnerParRating(joueurs);
    expect([...ordre].sort()).toEqual(joueurs.map((j) => j.profileId).sort());
  });
});

interface MatchCree {
  id: string;
  tour: number;
  position: number;
  match_suivant_id: string | null;
}

// Faux client : enregistre les matchs dans l'ordre de leur création.
function fauxClient(matchs: MatchCree[]) {
  const client = {
    from(table: string) {
      return {
        insert(ligne: Omit<MatchCree, "id">) {
          if (table === "matches") {
            matchs.push({ ...ligne, id: `m${matchs.length + 1}` });
          }
          const id = matchs[matchs.length - 1]?.id;
          const resultat = Promise.resolve({ data: null, error: null });
          return Object.assign(resultat, {
            select: () => ({ single: async () => ({ data: { id }, error: null }) }),
          });
        },
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
      };
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("construireBracket — structure exigée par la base", () => {
  // La base refuse un match d'organisateur dont le suivant n'existe pas
  // encore, n'est pas au tour d'après ou pas à la bonne position, et tout
  // match sans suivant hors du dernier tour (controler_ecriture_match,
  // audit sécurité du 10/10/2026).
  it.each([4, 8, 16, 32, 64, 128])("crée la finale d'abord et relie chaque match à son suivant (%i places)", async (capacite) => {
    const matchs: MatchCree[] = [];
    const joueurs = Array.from({ length: capacite }, (_, i) => `j${i}`);
    const { ok } = await construireBracket(fauxClient(matchs), "t", capacite, joueurs, async () => {});
    expect(ok).toBe(true);

    const nbTours = Math.log2(capacite);
    expect(matchs).toHaveLength(capacite - 1);
    expect(matchs[0]).toMatchObject({ tour: nbTours, position: 1, match_suivant_id: null });

    const parId = new Map<string, MatchCree>();
    for (const m of matchs) {
      if (m.tour === nbTours) {
        expect(m.match_suivant_id).toBeNull();
      } else {
        const suivant = m.match_suivant_id ? parId.get(m.match_suivant_id) : undefined;
        expect(suivant).toBeDefined();
        expect(suivant?.tour).toBe(m.tour + 1);
        expect(suivant?.position).toBe(Math.floor((m.position + 1) / 2));
      }
      parId.set(m.id, m);
    }
  });
});
