import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { abonnementStripe, fausseBase, type FausseBase } from "../../tests/fausse-base-stripe";
import { verifierAbonnementsStripe, type ClientAdmin } from "./abonnements-stripe-serveur";

// Vérification quotidienne des abonnements (23/11/2026) : un message du
// webhook perdu ne laisse ni une offre à un abonné qui ne paie plus, ni un
// abonné payant sans son offre (premier abonnement et réabonnement compris).
// Stripe et la base sont simulés. Comme chez Stripe, la liste sans statut
// ne rend pas les abonnements résiliés.

const JOUEUR = "11111111-1111-1111-1111-111111111111";
const AUTRE = "22222222-2222-2222-2222-222222222222";
const ADMIN = "99999999-9999-9999-9999-999999999999";
const CLIENT: Record<string, string> = { [JOUEUR]: "cus_joueur", [AUTRE]: "cus_autre", [ADMIN]: "cus_admin" };

type Abonnement = ReturnType<typeof abonnementStripe>;
const abonnementsStripe = new Map<string, Abonnement>();
let listeEnPanne = false;
let relectureEnPanne = false;
const relus: string[] = [];
let listes = 0;
const stripe = {
  subscriptions: {
    list: (parametres: { status?: string }) => ({
      autoPagingToArray: async ({ limit }: { limit: number }) => {
        listes += 1;
        if (listeEnPanne) throw new Error("Stripe ne répond pas");
        const tous = [...abonnementsStripe.values()].sort((a, b) => b.created - a.created);
        const rendus = parametres.status === "all" ? tous : tous.filter((a) => a.status !== "canceled");
        return rendus.slice(0, limit);
      },
    }),
    retrieve: async (id: string) => {
      relus.push(id);
      if (relectureEnPanne) throw new Error("Stripe ne répond pas");
      const abonnement = abonnementsStripe.get(id);
      if (!abonnement) throw Object.assign(new Error(`abonnement inconnu ${id}`), { code: "resource_missing" });
      return abonnement;
    },
  },
} as unknown as Stripe;

let base: FausseBase;
const verifier = (options?: { finAu?: number }) => verifierAbonnementsStripe(stripe, base as unknown as ClientAdmin, options);

/** Ligne de suivi en base (abonnement connu ou non, statut connu). */
function suivi(profil: string, abonnement: string | null, statutConnu: string | null, majLe = "2026-11-01T00:00:00Z") {
  base.tables.abonnements_stripe.push({
    profile_id: profil,
    client_stripe_id: CLIENT[profil],
    abonnement_stripe_id: abonnement,
    statut: statutConnu,
    maj_le: majLe,
  });
}
/** Abonnement chez Stripe, étiqueté pour ce joueur par notre serveur (sauf etiquette: false). */
function chezStripe(
  profil: string,
  id: string,
  statut: string,
  prix: string,
  options: { cree?: number; etiquette?: boolean; enPause?: boolean } = {},
) {
  abonnementsStripe.set(
    id,
    abonnementStripe({
      id,
      statut,
      prix,
      client: CLIENT[profil],
      profileId: options.etiquette === false ? undefined : profil,
      cree: options.cree,
      enPause: options.enPause,
    }),
  );
}
function offre(profil: string, nom: string, par: string | null = null, extra: Record<string, unknown> = {}) {
  base.tables.comptes_offres.push({ profile_id: profil, offre: nom, attribue_par: par, ...extra });
}
const offreDe = (profil: string) => base.tables.comptes_offres.find((l) => l.profile_id === profil);
const suiviDe = (profil: string) => base.tables.abonnements_stripe.find((l) => l.profile_id === profil);

beforeEach(() => {
  base = fausseBase();
  abonnementsStripe.clear();
  relus.length = 0;
  listes = 0;
  listeEnPanne = false;
  relectureEnPanne = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("STRIPE_PRICE_VERIFIE", "price_plus");
  vi.stubEnv("STRIPE_PRICE_ELITE", "price_pro");
  vi.stubEnv("STRIPE_PRICE_ORGANISATEUR", "price_orga");
});

describe("vérification quotidienne : offres à retirer", () => {
  it("résiliation dont le message s'est perdu : l'abonnement connu est relu, l'offre retirée", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "elite");
    chezStripe(JOUEUR, "sub_1", "canceled", "price_pro");
    expect(await verifier()).toMatchObject({ actif: true, retirees: 1 });
    expect(relus).toContain("sub_1");
    expect(offreDe(JOUEUR)).toBeUndefined();
    expect(suiviDe(JOUEUR)?.statut).toBe("canceled");
  });

  it("impayé : l'offre est retirée", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "unpaid", "price_plus");
    expect(await verifier()).toMatchObject({ retirees: 1 });
    expect(offreDe(JOUEUR)).toBeUndefined();
  });

  it("paiements mis en pause (statut « active ») : l'offre est retirée", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "active", "price_plus", { enPause: true });
    expect(await verifier()).toMatchObject({ retirees: 1 });
    expect(offreDe(JOUEUR)).toBeUndefined();
  });

  it("une offre donnée à la main par un administrateur n'est jamais retirée", async () => {
    suivi(JOUEUR, "sub_1", "canceled");
    offre(JOUEUR, "organisateur", ADMIN);
    chezStripe(JOUEUR, "sub_1", "canceled", "price_plus");
    await verifier();
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "organisateur", attribue_par: ADMIN });
    expect(relus).toHaveLength(0);
  });

  it("résiliation perdue puis nouvel abonnement pas encore payé : l'offre est retirée, le nouveau est suivi", async () => {
    suivi(JOUEUR, "sub_A", "active");
    offre(JOUEUR, "elite");
    chezStripe(JOUEUR, "sub_A", "canceled", "price_pro", { cree: 1_700_000_000 });
    chezStripe(JOUEUR, "sub_B", "past_due", "price_pro", { cree: 1_710_000_000 });
    expect(await verifier()).toMatchObject({ retirees: 1 });
    expect(offreDe(JOUEUR)).toBeUndefined();
    expect(suiviDe(JOUEUR)).toMatchObject({ abonnement_stripe_id: "sub_B", statut: "past_due" });
  });

  it("un abonnement suivi encore en vie n'est pas défait par un autre qui se termine", async () => {
    suivi(JOUEUR, "sub_A", "active");
    offre(JOUEUR, "elite");
    chezStripe(JOUEUR, "sub_A", "active", "price_pro", { cree: 1_700_000_000 });
    chezStripe(JOUEUR, "sub_B", "incomplete", "price_plus", { cree: 1_710_000_000 });
    expect(await verifier()).toMatchObject({ retirees: 0, accordees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("elite");
    expect(suiviDe(JOUEUR)?.abonnement_stripe_id).toBe("sub_A");
  });

  it("prix inconnu : signalé, l'offre reste (un mauvais réglage ne vide pas tous les abonnés)", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "active", "price_inconnu");
    expect(await verifier()).toMatchObject({ signales: 1, retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("offre accordée par Stripe mais abonnement inconnu de Stripe : signalée (avec le joueur), jamais retirée d'office", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    expect(await verifier()).toMatchObject({ signales: 1, retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(JOUEUR));
  });
});

describe("vérification quotidienne : offres à accorder", () => {
  it("abonnement payé et offre en place : aucune écriture", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie", null, { attribue_le: "2026-10-01" });
    chezStripe(JOUEUR, "sub_1", "active", "price_plus");
    expect(await verifier()).toMatchObject({ examines: 1, accordees: 0, retirees: 0, signales: 0, erreurs: 0 });
    expect(offreDe(JOUEUR)?.attribue_le).toBe("2026-10-01");
    expect(suiviDe(JOUEUR)?.maj_le).toBe("2026-11-01T00:00:00Z");
    expect(relus).toHaveLength(0);
  });

  it("premier abonnement dont le message de paiement s'est perdu : retrouvé, offre accordée", async () => {
    suivi(JOUEUR, null, null);
    chezStripe(JOUEUR, "sub_1", "active", "price_orga");
    expect(await verifier()).toMatchObject({ accordees: 1 });
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "organisateur", attribue_par: null });
    expect(suiviDe(JOUEUR)).toMatchObject({ abonnement_stripe_id: "sub_1", statut: "active" });
  });

  it("réabonnement après une résiliation, message perdu : le nouvel abonnement l'emporte", async () => {
    suivi(JOUEUR, "sub_ancien", "canceled");
    chezStripe(JOUEUR, "sub_ancien", "canceled", "price_plus", { cree: 1_700_000_000 });
    chezStripe(JOUEUR, "sub_nouveau", "active", "price_pro", { cree: 1_710_000_000 });
    expect(await verifier()).toMatchObject({ accordees: 1 });
    expect(offreDe(JOUEUR)?.offre).toBe("elite");
    expect(suiviDe(JOUEUR)).toMatchObject({ abonnement_stripe_id: "sub_nouveau", statut: "active" });
  });

  it("impayé redevenu payé, message perdu : l'offre revient", async () => {
    suivi(JOUEUR, "sub_1", "past_due");
    chezStripe(JOUEUR, "sub_1", "active", "price_plus");
    expect(await verifier()).toMatchObject({ accordees: 1 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("changement de formule perdu : l'offre suit le prix facturé", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "active", "price_pro");
    expect(await verifier()).toMatchObject({ accordees: 1 });
    expect(offreDe(JOUEUR)?.offre).toBe("elite");
  });

  it("offre offerte plus basse que l'offre payée : remplacée, comme par le webhook", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie", ADMIN);
    chezStripe(JOUEUR, "sub_1", "active", "price_pro");
    expect(await verifier()).toMatchObject({ accordees: 1 });
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "elite", attribue_par: null });
  });

  it("offre offerte au moins aussi haute sur un abonné : gardée, mais signalée", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "organisateur", ADMIN);
    chezStripe(JOUEUR, "sub_1", "active", "price_plus");
    expect(await verifier()).toMatchObject({ accordees: 0, signales: 1 });
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "organisateur", attribue_par: ADMIN });
  });

  it("abonnement créé hors du site (sans étiquette) : rien n'est accordé", async () => {
    suivi(JOUEUR, null, null);
    chezStripe(JOUEUR, "sub_1", "active", "price_plus", { etiquette: false });
    expect(await verifier()).toMatchObject({ accordees: 0 });
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("abonnement étiqueté pour un autre compte : ne donne rien au joueur suivi", async () => {
    suivi(JOUEUR, null, null);
    abonnementsStripe.set(
      "sub_1",
      abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", client: CLIENT[JOUEUR], profileId: AUTRE }),
    );
    expect(await verifier()).toMatchObject({ accordees: 0 });
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("un abonnement qui facture encore est suivi avant un ancien résilié", async () => {
    suivi(JOUEUR, "sub_ancien", "canceled");
    chezStripe(JOUEUR, "sub_ancien", "canceled", "price_plus", { cree: 1_700_000_000 });
    chezStripe(JOUEUR, "sub_impaye", "past_due", "price_plus", { cree: 1_710_000_000 });
    await verifier();
    // La suppression du compte reste bloquée tant que Stripe facture.
    expect(suiviDe(JOUEUR)).toMatchObject({ abonnement_stripe_id: "sub_impaye", statut: "past_due" });
    expect(base.tables.comptes_offres).toHaveLength(0);
  });
});

describe("vérification quotidienne : pannes, coût et course avec le webhook", () => {
  it("liste Stripe indisponible : rien n'est touché", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    listeEnPanne = true;
    expect(await verifier()).toMatchObject({ actif: false });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("relecture impossible d'un abonnement connu : rien n'est retiré", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "canceled", "price_plus");
    relectureEnPanne = true;
    expect(await verifier()).toMatchObject({ retirees: 0, signales: 1 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("écriture impossible : comptée en erreur, sans plantage", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "canceled", "price_plus");
    base.enEchec.add("comptes_offres");
    expect(await verifier()).toMatchObject({ erreurs: 1, retirees: 0 });
  });

  it("le webhook est passé pendant la vérification : la tâche n'écrit rien", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "canceled", "price_plus");
    // Le webhook réécrit le suivi juste après la lecture du début.
    const original = base.from;
    let lectures = 0;
    base.from = (table: string) => {
      if (table === "abonnements_stripe" && ++lectures === 2) suiviDe(JOUEUR)!.maj_le = "2026-11-23T10:00:00Z";
      return original(table);
    };
    expect(await verifier()).toMatchObject({ retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("un seul appel de liste pour tous les joueurs ; aucune relecture sans cas suspect", async () => {
    suivi(JOUEUR, "sub_1", "active");
    suivi(AUTRE, "sub_2", "canceled");
    suivi(ADMIN, null, null);
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "active", "price_plus");
    chezStripe(AUTRE, "sub_2", "canceled", "price_plus");
    expect(await verifier()).toMatchObject({ actif: true, abonnementsLus: 1, examines: 3, erreurs: 0 });
    expect(listes).toBe(1);
    expect(relus).toHaveLength(0);
  });

  it("toutes les lignes de la base sont lues, page par page", async () => {
    for (let i = 0; i < 1200; i += 1) {
      base.tables.abonnements_stripe.push({
        profile_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        client_stripe_id: `cus_${i}`,
        abonnement_stripe_id: null,
        statut: null,
        maj_le: "2026-11-01T00:00:00Z",
      });
    }
    expect(await verifier()).toMatchObject({ examines: 1200 });
  });

  it("heure limite dépassée : la suite au prochain passage", async () => {
    suivi(JOUEUR, "sub_1", "active");
    expect(await verifier({ finAu: Date.now() - 1 })).toMatchObject({ examines: 0, restants: true });
  });

  it("sans prix d'offre réglé, ne fait rien", async () => {
    vi.stubEnv("STRIPE_PRICE_VERIFIE", "");
    vi.stubEnv("STRIPE_PRICE_ELITE", "");
    vi.stubEnv("STRIPE_PRICE_ORGANISATEUR", "");
    suivi(JOUEUR, "sub_1", "active");
    expect(await verifier()).toMatchObject({ actif: false });
    expect(listes).toBe(0);
  });
});
