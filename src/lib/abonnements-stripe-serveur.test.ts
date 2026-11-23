import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { abonnementStripe, fausseBase, type FausseBase } from "../../tests/fausse-base-stripe";
import { verifierAbonnementsStripe, type ClientAdmin } from "./abonnements-stripe-serveur";

// Vérification quotidienne des abonnements (23/11/2026) : un message du
// webhook perdu ne laisse ni une offre à un abonné qui ne paie plus, ni un
// abonné payant sans son offre (premier abonnement et réabonnement compris).
// Stripe et la base sont simulés ; chaque joueur a son client Stripe.

const JOUEUR = "11111111-1111-1111-1111-111111111111";
const AUTRE = "22222222-2222-2222-2222-222222222222";
const ADMIN = "99999999-9999-9999-9999-999999999999";
const CLIENT: Record<string, string> = { [JOUEUR]: "cus_joueur", [AUTRE]: "cus_autre", [ADMIN]: "cus_admin" };

type Abonnement = ReturnType<typeof abonnementStripe>;
const abonnementsStripe = new Map<string, Abonnement>();
let stripeEnPanne = false;
const clientsLus: string[] = [];
const stripe = {
  subscriptions: {
    list: async ({ customer }: { customer: string }) => {
      clientsLus.push(customer);
      if (stripeEnPanne) throw new Error("Stripe ne répond pas");
      return { data: [...abonnementsStripe.values()].filter((a) => a.customer === customer) };
    },
    retrieve: async (id: string) => {
      if (stripeEnPanne) throw new Error("Stripe ne répond pas");
      const abonnement = abonnementsStripe.get(id);
      if (!abonnement) throw new Error(`abonnement inconnu ${id}`);
      return abonnement;
    },
  },
} as unknown as Stripe;

let base: FausseBase;
const verifier = (options?: { max?: number; finAu?: number }) =>
  verifierAbonnementsStripe(stripe, base as unknown as ClientAdmin, options);

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
/** Abonnement chez Stripe, étiqueté pour ce joueur par notre serveur (sauf étiquette: false). */
function chezStripe(profil: string, id: string, statut: string, prix: string, options: { cree?: number; etiquette?: boolean } = {}) {
  abonnementsStripe.set(
    id,
    abonnementStripe({
      id,
      statut,
      prix,
      client: CLIENT[profil],
      profileId: options.etiquette === false ? undefined : profil,
      cree: options.cree,
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
  clientsLus.length = 0;
  stripeEnPanne = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("STRIPE_PRICE_VERIFIE", "price_plus");
  vi.stubEnv("STRIPE_PRICE_ELITE", "price_pro");
  vi.stubEnv("STRIPE_PRICE_ORGANISATEUR", "price_orga");
});

describe("vérification quotidienne : offres à retirer", () => {
  it("résiliation dont le message s'est perdu : l'offre est retirée", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "elite");
    chezStripe(JOUEUR, "sub_1", "canceled", "price_pro");
    expect(await verifier()).toMatchObject({ actif: true, retirees: 1 });
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

  it("une offre donnée à la main par un administrateur n'est jamais retirée", async () => {
    suivi(JOUEUR, "sub_1", "canceled");
    offre(JOUEUR, "organisateur", ADMIN);
    chezStripe(JOUEUR, "sub_1", "canceled", "price_plus");
    await verifier();
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "organisateur", attribue_par: ADMIN });
  });

  it("prix inconnu : signalé, l'offre reste (un mauvais réglage ne vide pas tous les abonnés)", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "active", "price_inconnu");
    expect(await verifier()).toMatchObject({ signales: 1, retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("offre accordée par Stripe mais aucun abonnement chez ce client : signalée, jamais retirée d'office", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    expect(await verifier()).toMatchObject({ signales: 1, retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });
});

describe("vérification quotidienne : offres à accorder", () => {
  it("abonnement payé et offre en place : rien ne change, sauf la date de relecture", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie", null, { attribue_le: "2026-10-01" });
    chezStripe(JOUEUR, "sub_1", "active", "price_plus");
    expect(await verifier()).toMatchObject({ examines: 1, accordees: 0, retirees: 0, signales: 0, erreurs: 0 });
    expect(offreDe(JOUEUR)?.attribue_le).toBe("2026-10-01");
    expect(suiviDe(JOUEUR)?.maj_le).not.toBe("2026-11-01T00:00:00Z");
  });

  it("premier abonnement dont le message de paiement s'est perdu : retrouvé chez le client, offre accordée", async () => {
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

  it("réabonné relu à son tour même parmi de nombreux paiements abandonnés", async () => {
    suivi(JOUEUR, "sub_ancien", "canceled", "2026-10-01T00:00:00Z");
    chezStripe(JOUEUR, "sub_ancien", "canceled", "price_plus", { cree: 1_700_000_000 });
    chezStripe(JOUEUR, "sub_nouveau", "active", "price_plus", { cree: 1_710_000_000 });
    suivi(AUTRE, null, null, "2026-11-02T00:00:00Z");
    suivi(ADMIN, null, null, "2026-11-03T00:00:00Z");
    expect(await verifier({ max: 1 })).toMatchObject({ accordees: 1 });
    expect(clientsLus).toEqual(["cus_joueur"]);
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

  it("abonnement créé hors du site (sans étiquette) : rien n'est accordé", async () => {
    suivi(JOUEUR, null, null);
    chezStripe(JOUEUR, "sub_1", "active", "price_plus", { etiquette: false });
    expect(await verifier()).toMatchObject({ accordees: 0 });
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("abonnement étiqueté pour un autre compte : ignoré", async () => {
    suivi(JOUEUR, null, null);
    abonnementsStripe.set(
      "sub_1",
      abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", client: CLIENT[JOUEUR], profileId: AUTRE }),
    );
    expect(await verifier()).toMatchObject({ accordees: 0 });
    expect(base.tables.comptes_offres).toHaveLength(0);
  });
});

describe("vérification quotidienne : pannes et limites", () => {
  it("Stripe ne répond pas : rien n'est retiré, réessayé au prochain passage", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    stripeEnPanne = true;
    expect(await verifier()).toMatchObject({ erreurs: 1, retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("écriture impossible : comptée en erreur, sans plantage", async () => {
    suivi(JOUEUR, "sub_1", "active");
    offre(JOUEUR, "verifie");
    chezStripe(JOUEUR, "sub_1", "canceled", "price_plus");
    base.enEchec.add("comptes_offres");
    expect(await verifier()).toMatchObject({ erreurs: 1, retirees: 0 });
  });

  it("rotation : les clients relus le moins récemment passent d'abord, un abonnement terminé compris", async () => {
    suivi(JOUEUR, "sub_1", "active", "2026-11-20T00:00:00Z");
    suivi(AUTRE, "sub_2", "active", "2026-11-10T00:00:00Z");
    offre(JOUEUR, "verifie");
    offre(AUTRE, "verifie");
    chezStripe(JOUEUR, "sub_1", "active", "price_plus");
    chezStripe(AUTRE, "sub_2", "active", "price_plus");
    await verifier({ max: 1 });
    expect(clientsLus).toEqual(["cus_autre"]);
    clientsLus.length = 0;
    await verifier({ max: 1 });
    expect(clientsLus).toEqual(["cus_joueur"]);
    expect(await verifier({ max: 1 })).toMatchObject({ examines: 1, restants: true });
  });

  it("un client sans abonnement est quand même noté relu (rotation)", async () => {
    suivi(JOUEUR, null, null);
    await verifier();
    expect(suiviDe(JOUEUR)?.maj_le).not.toBe("2026-11-01T00:00:00Z");
  });

  it("heure limite dépassée : aucun client commencé, la suite au prochain passage", async () => {
    suivi(JOUEUR, "sub_1", "active");
    expect(await verifier({ finAu: Date.now() - 1 })).toMatchObject({ examines: 0, restants: true });
    expect(clientsLus).toHaveLength(0);
  });

  it("sans prix d'offre réglé, ne fait rien", async () => {
    vi.stubEnv("STRIPE_PRICE_VERIFIE", "");
    vi.stubEnv("STRIPE_PRICE_ELITE", "");
    vi.stubEnv("STRIPE_PRICE_ORGANISATEUR", "");
    suivi(JOUEUR, "sub_1", "active");
    expect(await verifier()).toMatchObject({ actif: false });
    expect(clientsLus).toHaveLength(0);
  });
});
