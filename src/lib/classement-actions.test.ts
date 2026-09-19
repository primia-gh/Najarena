// Teste l'orchestration de cloturerTournoi (quels matchs comptent, quel état
// de départ, quels appels d'écriture, dans quel ordre) avec une FAUSSE base :
// les requêtes sont enregistrées et reçoivent des réponses préparées. Cela ne
// prouve rien sur SQL ni sur la RLS — ces deux couches ont été vérifiées à
// part, sur la vraie base, dans une transaction annulée (18-19/09/2026).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ creerClientAdmin: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { appliquerRotationSaisons, cloturerTournoi } from "./classement-actions";
import { softResetSaison } from "./glicko2";

interface Appel {
  table: string;
  op: "select" | "update";
  valeurs?: Record<string, unknown>;
}
interface Reponse {
  data: unknown;
  error: { message: string } | null;
}
type Repondeur = (appel: Appel) => Reponse;
interface AppelRpc {
  nom: string;
  params: Record<string, unknown>;
}

// Chronologie commune aux deux clients : sert à vérifier l'ORDRE des écritures.
let chrono: string[];
let journalSession: Appel[];
let journalAdmin: Appel[];
let rpcs: AppelRpc[];

class Requete implements PromiseLike<Reponse> {
  private readonly appel: Appel;

  constructor(
    table: string,
    private readonly repondre: Repondeur,
    private readonly journal: Appel[],
  ) {
    this.appel = { table, op: "select" };
  }

  select() {
    return this;
  }
  update(valeurs: Record<string, unknown>) {
    this.appel.op = "update";
    this.appel.valeurs = valeurs;
    return this;
  }
  eq() {
    return this;
  }
  in() {
    return this;
  }
  gte() {
    return this;
  }
  lt() {
    return this;
  }
  maybeSingle() {
    return this;
  }
  then<R1 = Reponse, R2 = never>(
    onfulfilled?: ((valeur: Reponse) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((raison: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    this.journal.push(this.appel);
    if (this.appel.op === "update") {
      chrono.push(`update:${JSON.stringify(this.appel.valeurs)}`);
    }
    return Promise.resolve(this.repondre(this.appel)).then(onfulfilled, onrejected);
  }
}

const ok = (data: unknown): Reponse => ({ data, error: null });

interface Options {
  tournoi?: Record<string, unknown>;
  saisonCourante?: string | null;
  matchs?: unknown[];
  victoiresRecentes?: number;
  joueursEnEchec?: string[];
  /** Rotation : liste des saisons (sinon `seasons` renvoie la saison courante seule). */
  saisons?: unknown[];
  /** Rotation : ratings de la saison courante. */
  ratings?: unknown[];
}

const TOUS = ["u1", "u2", "u3", "u4"];
const verdict = (niveau: string, gagnant: string, cree_le: string) => [
  { niveau, gagnant_id: gagnant, cree_le, est_definitif: true },
];
const matchsNormaux = [
  { id: "m1", statut: "termine", match_participants: [{ profile_id: "u1" }, { profile_id: "u2" }], verdict: verdict("historique", "u1", "2026-09-19T10:00:00Z") },
  { id: "m2", statut: "termine", match_participants: [{ profile_id: "u3" }, { profile_id: "u4" }], verdict: verdict("historique", "u3", "2026-09-19T10:05:00Z") },
  { id: "m3", statut: "termine", match_participants: [{ profile_id: "u1" }, { profile_id: "u3" }], verdict: verdict("historique", "u1", "2026-09-19T11:00:00Z") },
];

function installer(o: Options = {}, avecAdmin = true) {
  const repondre: Repondeur = (a) => {
    if (a.table === "tournaments" && a.op === "select") {
      return ok({ id: "T1", game_id: 1, season_id: "S1", statut: "en_cours", compte_pour_classement: true, ...o.tournoi });
    }
    if (a.table === "seasons") {
      if (o.saisons) return ok(o.saisons);
      return ok(o.saisonCourante === undefined ? { id: "SCOURANTE" } : o.saisonCourante ? { id: o.saisonCourante } : null);
    }
    if (a.table === "matches") return ok(o.matchs ?? matchsNormaux);
    if (a.table === "match_verdicts") {
      return ok(
        Array.from({ length: o.victoiresRecentes ?? 0 }, () => ({
          match_id: "ancien",
          cree_le: "2026-09-19T09:00:00Z",
          match: { statut: "termine", match_participants: TOUS.map((profile_id) => ({ profile_id })) },
        })),
      );
    }
    if (a.table === "ratings") return ok(o.ratings ?? []);
    return ok(null);
  };

  vi.mocked(createClient).mockResolvedValue({
    from: (table: string) => new Requete(table, repondre, journalSession),
  } as never);

  vi.mocked(creerClientAdmin).mockReturnValue(
    avecAdmin
      ? ({
          from: (table: string) => new Requete(table, repondre, journalAdmin),
          rpc: (nom: string, params: Record<string, unknown>) => {
            rpcs.push({ nom, params });
            chrono.push(`rpc:${String(params.p_profile_id)}`);
            const echec = (o.joueursEnEchec ?? []).includes(String(params.p_profile_id));
            return Promise.resolve({ data: !echec, error: echec ? { message: "boum" } : null });
          },
        } as never)
      : null,
  );
}

const rpcDe = (profil: string) => rpcs.find((r) => r.params.p_profile_id === profil)!.params;
const misesAJourStatut = (j: Appel[]) => j.filter((a) => a.op === "update" && a.valeurs?.statut === "termine");

beforeEach(() => {
  chrono = [];
  journalSession = [];
  journalAdmin = [];
  rpcs = [];
  vi.clearAllMocks();
});

describe("cloturerTournoi", () => {
  it("écrit le statut « terminé » avec le client admin, jamais avec la session (le cron n'a pas de session)", async () => {
    installer();
    await cloturerTournoi("T1");

    expect(misesAJourStatut(journalAdmin)).toHaveLength(1);
    expect(misesAJourStatut(journalSession)).toHaveLength(0);
  });

  it("sans clé de service, retombe sur la session pour le statut et n'écrit aucun rating", async () => {
    installer({}, false);
    await cloturerTournoi("T1");

    expect(misesAJourStatut(journalSession)).toHaveLength(1);
    expect(rpcs).toHaveLength(0);
  });

  it("un tournoi déjà terminé n'écrit plus rien", async () => {
    installer({ tournoi: { statut: "termine" } });
    await cloturerTournoi("T1");

    expect(rpcs).toHaveLength(0);
    expect(journalAdmin.filter((a) => a.op === "update")).toHaveLength(0);
  });

  it("un tournoi hors classement est clôturé sans écrire de rating", async () => {
    installer({ tournoi: { compte_pour_classement: false } });
    await cloturerTournoi("T1");

    expect(misesAJourStatut(journalAdmin)).toHaveLength(1);
    expect(rpcs).toHaveLength(0);
  });

  it("rattache à la saison courante un tournoi sans season_id, et l'utilise pour les ratings", async () => {
    installer({ tournoi: { season_id: null }, saisonCourante: "SCOURANTE" });
    await cloturerTournoi("T1");

    expect(journalAdmin.some((a) => a.op === "update" && a.valeurs?.season_id === "SCOURANTE")).toBe(true);
    expect(rpcs).toHaveLength(4);
    expect(rpcs.every((r) => r.params.p_season_id === "SCOURANTE")).toBe(true);
  });

  it("sans saison courante ni season_id : tournoi clôturé, aucun rating écrit", async () => {
    installer({ tournoi: { season_id: null }, saisonCourante: null });
    await cloturerTournoi("T1");

    expect(misesAJourStatut(journalAdmin)).toHaveLength(1);
    expect(rpcs).toHaveLength(0);
  });

  it("calcule chaque joueur depuis l'état initial, avec le bon nombre de matchs comptés", async () => {
    installer();
    await cloturerTournoi("T1");

    expect(rpcs).toHaveLength(4);
    for (const r of rpcs) {
      expect(r.nom).toBe("cloturer_rating_joueur");
      expect(r.params).toMatchObject({
        p_game_id: 1,
        p_season_id: "S1",
        p_tournament_id: "T1",
        p_rating_avant: 1500,
        p_rd_avant: 350,
        p_motif: "tournoi",
      });
    }
    expect(rpcDe("u1").p_matchs_comptes).toBe(2); // gagne m1 et la finale
    expect(rpcDe("u2").p_matchs_comptes).toBe(1);
    expect(rpcDe("u3").p_matchs_comptes).toBe(2); // gagne m2, perd la finale
    expect(rpcDe("u4").p_matchs_comptes).toBe(1);
    expect(Number(rpcDe("u1").p_rating_apres)).toBeGreaterThan(1500);
    expect(Number(rpcDe("u2").p_rating_apres)).toBeLessThan(1500);
    expect(Number(rpcDe("u1").p_rating_apres)).toBeGreaterThan(Number(rpcDe("u3").p_rating_apres));
  });

  it("un verdict manuel (niveau 1) et un forfait ne rapportent aucun point", async () => {
    installer({
      matchs: [
        { id: "m1", statut: "termine", match_participants: [{ profile_id: "u1" }, { profile_id: "u2" }], verdict: verdict("manuel", "u1", "2026-09-19T10:00:00Z") },
        { id: "m2", statut: "forfait", match_participants: [{ profile_id: "u3" }, { profile_id: "u4" }], verdict: verdict("historique", "u3", "2026-09-19T10:05:00Z") },
      ],
    });
    await cloturerTournoi("T1");

    for (const j of TOUS) {
      expect(rpcDe(j).p_matchs_comptes).toBe(0);
      expect(Number(rpcDe(j).p_rating_apres)).toBe(1500);
    }
  });

  it("plafond anti-abus : au-delà de 3 victoires récentes contre le même adversaire, la victoire est ignorée", async () => {
    installer({ victoiresRecentes: 3 });
    await cloturerTournoi("T1");

    for (const j of TOUS) expect(rpcDe(j).p_matchs_comptes).toBe(0);
  });

  it("sous le plafond (2 victoires récentes), les victoires comptent", async () => {
    installer({ victoiresRecentes: 2 });
    await cloturerTournoi("T1");

    expect(rpcDe("u1").p_matchs_comptes).toBe(2);
  });

  it("marque le tournoi « terminé » APRÈS l'écriture de tous les ratings", async () => {
    installer();
    await cloturerTournoi("T1");

    const dernier = chrono[chrono.length - 1];
    expect(dernier).toBe('update:{"statut":"termine"}');
    expect(chrono.filter((e) => e.startsWith("rpc:"))).toHaveLength(4);
  });

  it("si l'écriture d'un rating échoue, le tournoi n'est PAS marqué terminé (il pourra être repris)", async () => {
    installer({ joueursEnEchec: ["u2"] });
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    await cloturerTournoi("T1");

    expect(misesAJourStatut(journalAdmin)).toHaveLength(0);
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });

  it("une reprise après échec écrit les ratings puis marque le tournoi terminé", async () => {
    installer({ joueursEnEchec: ["u2"] });
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    await cloturerTournoi("T1");
    erreur.mockRestore();

    rpcs = [];
    journalAdmin = [];
    installer({});
    await cloturerTournoi("T1");

    expect(rpcs).toHaveLength(4);
    expect(misesAJourStatut(journalAdmin)).toHaveLength(1);
  });
});

describe("appliquerRotationSaisons", () => {
  const passe = "2026-09-01T00:00:00Z";
  const futur = "2099-01-01T00:00:00Z";
  const s1 = { id: "S1", game_id: 1, numero: 1, debut_le: "2026-06-01T00:00:00Z", est_courante: true };
  const s2 = { id: "S2", game_id: 1, numero: 2, debut_le: passe, est_courante: false };
  const ratingsS1 = [
    { profile_id: "u1", rating: 1800, rd: 200, volatilite: 0.06 },
    { profile_id: "u2", rating: 1300, rd: 120, volatilite: 0.06 },
  ];
  const appelsDe = (nom: string) => rpcs.filter((r) => r.nom === nom);

  it("applique le soft reset (15 % vers 1500, RD × 1,8) à chaque joueur puis bascule la saison", async () => {
    installer({ saisons: [s1, s2], ratings: ratingsS1 });
    const bilan = await appliquerRotationSaisons();

    const resets = appelsDe("appliquer_soft_reset_saison");
    expect(resets).toHaveLength(2);
    const attendu = softResetSaison({ rating: 1800, rd: 200, volatilite: 0.06 });
    expect(resets.find((r) => r.params.p_profile_id === "u1")!.params).toMatchObject({
      p_season_id: "S2",
      p_rating_avant: 1800,
      p_rating_apres: attendu.rating,
      p_rd_apres: attendu.rd,
    });
    expect(appelsDe("activer_saison")).toEqual([
      { nom: "activer_saison", params: { p_game_id: 1, p_nouvelle_saison_id: "S2" } },
    ]);
    expect(bilan).toEqual({ saisonsActivees: 1, joueursTraites: 2 });
    // Les resets sont écrits AVANT la bascule.
    expect(chrono.indexOf("rpc:u2")).toBeLessThan(chrono.length);
  });

  it("ne fait rien tant que la saison suivante n'a pas commencé", async () => {
    installer({ saisons: [s1, { ...s2, debut_le: futur }], ratings: ratingsS1 });
    const bilan = await appliquerRotationSaisons();

    expect(rpcs).toHaveLength(0);
    expect(bilan).toEqual({ saisonsActivees: 0, joueursTraites: 0 });
  });

  it("ne fait rien quand la saison cible est déjà la saison courante (relance)", async () => {
    installer({ saisons: [{ ...s1, est_courante: false }, { ...s2, est_courante: true }], ratings: ratingsS1 });
    const bilan = await appliquerRotationSaisons();

    expect(rpcs).toHaveLength(0);
    expect(bilan.saisonsActivees).toBe(0);
  });

  it("première saison (aucune courante) : bascule sans soft reset", async () => {
    installer({ saisons: [{ ...s1, est_courante: false }] });
    await appliquerRotationSaisons();

    expect(appelsDe("appliquer_soft_reset_saison")).toHaveLength(0);
    expect(appelsDe("activer_saison")).toHaveLength(1);
  });

  it("si un soft reset échoue, la saison n'est PAS basculée (reprise à la prochaine exécution)", async () => {
    installer({ saisons: [s1, s2], ratings: ratingsS1, joueursEnEchec: ["u2"] });
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const bilan = await appliquerRotationSaisons();
    erreur.mockRestore();

    expect(appelsDe("activer_saison")).toHaveLength(0);
    expect(bilan.saisonsActivees).toBe(0);
  });
});
