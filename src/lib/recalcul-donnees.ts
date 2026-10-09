import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { DonneesIndisponibles } from "@/lib/donnees-publiques";
import type { DonneesRecalcul, MatchJoueur } from "@/lib/recalcul";

// Données du « Recalcule toi-même » (09/10/2026, idée en réserve n°4), lues
// avec le client anonyme : rien que ce qu'un visiteur déconnecté peut déjà
// lire (registre public, brackets, verdicts). Servies telles quelles par
// /api/public/v1/joueurs/[pseudo]/recalcul ; le calcul se fait chez le
// visiteur (lib/recalcul.ts).

type Client = SupabaseClient<Database>;

const PAGE = 1000; // plafond de lignes par réponse de l'API Supabase
const PAR_PAQUET = 15; // tournois par requête (longueur d'adresse)

export interface DonneesRecalculPubliques extends DonneesRecalcul {
  joueur: { pseudo: string; slug: string };
  tournois: Record<string, { nom: string; slug: string; nature: string }>;
}

function paquets<T>(liste: T[]): T[][] {
  const sortie: T[][] = [];
  for (let i = 0; i < liste.length; i += PAR_PAQUET) sortie.push(liste.slice(i, i + PAR_PAQUET));
  return sortie;
}

function verifier<T extends { error: unknown }>(reponse: T): T {
  if (reponse.error) throw new DonneesIndisponibles("Base injoignable");
  return reponse;
}

/** Toutes les lignes d'une lecture, page par page. */
async function toutLire<T>(
  page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const sortie: T[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data } = verifier(await page(de, de + PAGE - 1));
    sortie.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return sortie;
  }
}

export async function chargerDonneesRecalcul(supabase: Client, slug: string): Promise<DonneesRecalculPubliques | null> {
  const { data: profil } = verifier(
    await supabase.from("profiles").select("id, pseudo, slug, supprime_le").eq("slug", slug).maybeSingle(),
  );
  if (!profil || profil.supprime_le) return null;

  const [lignesData, participations] = await Promise.all([
    toutLire((de, a) =>
      supabase
        .from("rating_events")
        .select("numero, motif, tournament_id, rating_avant, rd_avant, rating_apres, rd_apres")
        .eq("profile_id", profil.id)
        .eq("game_id", 1)
        .order("numero", { ascending: true })
        .range(de, a),
    ),
    toutLire((de, a) =>
      supabase
        .from("match_participants")
        .select(
          "match_id, match:matches(id, tournament_id, statut, match_participants(profile_id), match_verdicts(niveau, gagnant_id, cree_le, est_definitif))",
        )
        .eq("profile_id", profil.id)
        .order("match_id", { ascending: true })
        .range(de, a),
    ),
  ]);

  const lignes = lignesData.map((l) => ({
    numero: Number(l.numero),
    motif: l.motif,
    tournament_id: l.tournament_id,
    rating_avant: Number(l.rating_avant),
    rd_avant: Number(l.rd_avant),
    rating_apres: Number(l.rating_apres),
    rd_apres: Number(l.rd_apres),
  }));

  const matchs: MatchJoueur[] = participations.flatMap((p) => {
    const m = p.match;
    if (!m) return [];
    const verdict = m.match_verdicts.find((v) => v.est_definitif) ?? null;
    return [
      {
        id: m.id,
        tournament_id: m.tournament_id,
        statut: m.statut,
        adversaire_id: m.match_participants.find((x) => x.profile_id !== profil.id)?.profile_id ?? null,
        verdict: verdict ? { niveau: verdict.niveau, gagnant_id: verdict.gagnant_id, cree_le: verdict.cree_le } : null,
      },
    ];
  });

  // État de départ des adversaires, tournoi par tournoi : leur propre ligne
  // du registre pour ce tournoi (le serveur ne lit que leur rating et leur RD).
  const idsTournois = [
    ...new Set(lignes.filter((l) => l.motif === "tournoi" && l.tournament_id).map((l) => l.tournament_id!)),
  ];
  const departs: DonneesRecalcul["departs"] = {};
  const tournois: DonneesRecalculPubliques["tournois"] = {};

  await Promise.all(
    paquets(idsTournois).map(async (ids) => {
      const adversaires = [
        ...new Set(
          matchs.flatMap((m) => (ids.includes(m.tournament_id) && m.adversaire_id ? [m.adversaire_id] : [])),
        ),
      ];
      const [{ data: etats }, { data: infos }] = await Promise.all([
        adversaires.length
          ? supabase
              .from("rating_events")
              .select("profile_id, tournament_id, rating_avant, rd_avant")
              .eq("motif", "tournoi")
              .in("tournament_id", ids)
              .in("profile_id", adversaires)
              .then(verifier)
          : Promise.resolve({ data: [] as { profile_id: string; tournament_id: string | null; rating_avant: number; rd_avant: number }[] }),
        supabase.from("tournaments").select("id, nom, slug, nature").in("id", ids).then(verifier),
      ]);
      for (const e of etats ?? []) {
        if (!e.tournament_id) continue;
        (departs[e.tournament_id] ??= {})[e.profile_id] = {
          rating_avant: Number(e.rating_avant),
          rd_avant: Number(e.rd_avant),
        };
      }
      for (const t of infos ?? []) tournois[t.id] = { nom: t.nom, slug: t.slug, nature: t.nature };
    }),
  );

  return { joueur: { pseudo: profil.pseudo, slug: profil.slug }, profileId: profil.id, lignes, matchs, departs, tournois };
}
