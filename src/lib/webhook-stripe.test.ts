import { beforeEach, describe, expect, it, vi } from "vitest";
import { abonnementStripe, fausseBase, type FausseBase } from "../../tests/fausse-base-stripe";

// Webhook Stripe (src/app/api/stripe/webhook/route.ts) avec Stripe simulé :
// signature, relecture de l'abonnement, offre accordée ou retirée, pannes.
// La signature est « signe:<secret> » ; l'abonnement relu est celui de
// `etatsStripe` (le dernier état reste quand la liste est épuisée).

const etatsStripe = new Map<string, ReturnType<typeof abonnementStripe>[]>();
let stripeEnPanne = false;
let base: FausseBase;

vi.mock("stripe", () => ({
  default: class {
    webhooks = {
      constructEvent: (corps: string, signature: string, secret: string) => {
        if (signature !== `signe:${secret}`) throw new Error("signature invalide");
        return JSON.parse(corps);
      },
    };
    subscriptions = {
      retrieve: async (id: string) => {
        if (stripeEnPanne) throw new Error("Stripe ne répond pas");
        const etats = etatsStripe.get(id);
        if (!etats?.length) throw new Error(`abonnement inconnu ${id}`);
        return etats.length > 1 ? etats.shift() : etats[0];
      },
    };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ creerClientAdmin: () => base }));

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_faux");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_principal");
vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_connect");
vi.stubEnv("STRIPE_PRICE_VERIFIE", "price_plus");
vi.stubEnv("STRIPE_PRICE_ELITE", "price_pro_nouveau, price_pro_ancien");
vi.stubEnv("STRIPE_PRICE_ORGANISATEUR", "price_orga");

const { POST } = await import("@/app/api/stripe/webhook/route");

const JOUEUR = "11111111-1111-1111-1111-111111111111";
const AUTRE = "22222222-2222-2222-2222-222222222222";
const ADMIN = "99999999-9999-9999-9999-999999999999";

function requete(evenement: unknown, secret = "whsec_principal") {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": `signe:${secret}` },
    body: JSON.stringify(evenement),
  });
}

function evenementAbonnement(type: string, objet: unknown, extra: Record<string, unknown> = {}) {
  return { id: "evt_1", type, data: { object: objet }, ...extra };
}

function stripeDira(...etats: ReturnType<typeof abonnementStripe>[]) {
  etatsStripe.set(etats[0].id, [...etats]);
}

const offreDe = (profil: string) => base.tables.comptes_offres.find((l) => l.profile_id === profil);
const suiviDe = (profil: string) => base.tables.abonnements_stripe.find((l) => l.profile_id === profil);

beforeEach(() => {
  base = fausseBase();
  etatsStripe.clear();
  stripeEnPanne = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("signature", () => {
  it("refuse un événement mal signé", async () => {
    const reponse = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "signe:faux" },
        body: "{}",
      }),
    );
    expect(reponse.status).toBe(400);
  });

  it("le secret principal n'ouvre pas les comptes de versement (Connect)", async () => {
    const reponse = await POST(requete(evenementAbonnement("account.updated", { id: "acct_1" }, { account: "acct_1" })));
    expect(reponse.status).toBe(200);
    expect(base.appelsRpc).toHaveLength(0);
  });

  it("le secret Connect met à jour un compte de versement, jamais un abonnement", async () => {
    const compte = { id: "acct_1", charges_enabled: true, payouts_enabled: true, requirements: { currently_due: [] } };
    await POST(requete(evenementAbonnement("account.updated", compte, { account: "acct_1" }), "whsec_connect"));
    expect(base.appelsRpc.map((a) => a.nom)).toEqual(["maj_compte_versement"]);

    const abonnement = abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR });
    stripeDira(abonnement);
    await POST(requete(evenementAbonnement("customer.subscription.updated", abonnement), "whsec_connect"));
    expect(offreDe(JOUEUR)).toBeUndefined();
  });
});

describe("paiement d'un abonnement", () => {
  it("accorde l'offre du prix facturé et garde l'état de l'abonnement", async () => {
    stripeDira(abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR }));
    const reponse = await POST(
      requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: JOUEUR })),
    );
    expect(reponse.status).toBe(200);
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "verifie", attribue_par: null });
    expect(suiviDe(JOUEUR)).toMatchObject({ abonnement_stripe_id: "sub_1", statut: "active", client_stripe_id: "cus_1" });
  });

  it("une session de paiement sans abonnement n'écrit rien", async () => {
    const reponse = await POST(
      requete(evenementAbonnement("checkout.session.completed", { subscription: null, client_reference_id: JOUEUR })),
    );
    expect(reponse.status).toBe(200);
    expect(base.tables.comptes_offres).toHaveLength(0);
    expect(base.tables.abonnements_stripe).toHaveLength(0);
  });

  it("un paiement différé (incomplete) n'accorde rien encore", async () => {
    stripeDira(abonnementStripe({ id: "sub_1", statut: "incomplete", prix: "price_plus", profileId: JOUEUR }));
    await POST(requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: JOUEUR })));
    expect(offreDe(JOUEUR)).toBeUndefined();
  });

  it("une session qui désigne un autre compte que l'abonnement n'accorde rien", async () => {
    stripeDira(abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR }));
    await POST(requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: AUTRE })));
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("un abonnement créé hors du site (sans étiquette) n'accorde rien", async () => {
    const abonnement = abonnementStripe({ id: "sub_1", statut: "active", prix: "price_orga" });
    stripeDira(abonnement);
    await POST(requete(evenementAbonnement("customer.subscription.updated", abonnement)));
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("une résiliation survenue pendant l'écriture retire l'offre aussitôt (seconde lecture)", async () => {
    stripeDira(
      abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR }),
      abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_plus", profileId: JOUEUR }),
    );
    await POST(requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: JOUEUR })));
    expect(offreDe(JOUEUR)).toBeUndefined();
  });
});

describe("vie de l'abonnement", () => {
  async function abonne(prix = "price_plus") {
    stripeDira(abonnementStripe({ id: "sub_1", statut: "active", prix, profileId: JOUEUR }));
    await POST(requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: JOUEUR })));
    expect(offreDe(JOUEUR)).toBeDefined();
  }

  it("un changement de formule dans le portail suit le prix facturé, ancien prix compris", async () => {
    await abonne();
    const passePro = abonnementStripe({ id: "sub_1", statut: "active", prix: "price_pro_ancien", profileId: JOUEUR });
    stripeDira(passePro);
    await POST(requete(evenementAbonnement("customer.subscription.updated", passePro)));
    expect(offreDe(JOUEUR)?.offre).toBe("elite");
  });

  it("un impayé retire l'offre", async () => {
    await abonne();
    const impaye = abonnementStripe({ id: "sub_1", statut: "past_due", prix: "price_plus", profileId: JOUEUR });
    stripeDira(impaye);
    await POST(requete(evenementAbonnement("customer.subscription.updated", impaye)));
    expect(offreDe(JOUEUR)).toBeUndefined();
    expect(suiviDe(JOUEUR)?.statut).toBe("past_due");
  });

  it("un vieil « active » reçu après la résiliation ne rend pas l'offre (état relu chez Stripe)", async () => {
    await abonne();
    stripeDira(abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_plus", profileId: JOUEUR }));
    const ancien = abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR });
    await POST(requete(evenementAbonnement("customer.subscription.updated", ancien)));
    expect(offreDe(JOUEUR)).toBeUndefined();
  });

  it("un prix qui n'est celui d'aucune offre retire l'offre", async () => {
    await abonne();
    const inconnu = abonnementStripe({ id: "sub_1", statut: "active", prix: "price_inconnu", profileId: JOUEUR });
    stripeDira(inconnu);
    await POST(requete(evenementAbonnement("customer.subscription.updated", inconnu)));
    expect(offreDe(JOUEUR)).toBeUndefined();
  });

  it("la fin d'un ancien abonnement ne touche pas l'abonnement actuel", async () => {
    await abonne();
    const ancien = abonnementStripe({ id: "sub_0", statut: "canceled", prix: "price_plus", profileId: JOUEUR });
    stripeDira(ancien);
    await POST(requete(evenementAbonnement("customer.subscription.deleted", ancien)));
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
    expect(suiviDe(JOUEUR)?.abonnement_stripe_id).toBe("sub_1");
  });

  it("la résiliation ne retire pas une offre donnée depuis par un administrateur", async () => {
    await abonne();
    Object.assign(offreDe(JOUEUR)!, { offre: "organisateur", attribue_par: ADMIN });
    const resilie = abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_plus", profileId: JOUEUR });
    stripeDira(resilie);
    await POST(requete(evenementAbonnement("customer.subscription.deleted", resilie)));
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "organisateur", attribue_par: ADMIN });
  });

  it("un abonnement payé remplace une offre donnée à la main, puis la retire à sa fin", async () => {
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "organisateur", attribue_par: ADMIN, bio: "Ma bio" });
    await abonne();
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "verifie", attribue_par: null, bio: "Ma bio" });
    const resilie = abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_plus", profileId: JOUEUR });
    stripeDira(resilie);
    await POST(requete(evenementAbonnement("customer.subscription.deleted", resilie)));
    expect(offreDe(JOUEUR)).toBeUndefined();
  });
});

describe("pannes : Stripe renverra l'événement", () => {
  it("Stripe ne répond pas → 503, rien n'est écrit", async () => {
    stripeEnPanne = true;
    const reponse = await POST(
      requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: JOUEUR })),
    );
    expect(reponse.status).toBe(503);
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("écriture de l'offre impossible → 503", async () => {
    stripeDira(abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR }));
    base.enEchec.add("comptes_offres");
    const reponse = await POST(
      requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: JOUEUR })),
    );
    expect(reponse.status).toBe(503);
  });

  it("retrait impossible après une résiliation → 503 (l'offre n'est pas laissée en silence)", async () => {
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "verifie", attribue_par: null });
    const resilie = abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_plus", profileId: JOUEUR });
    stripeDira(resilie);
    base.enEchec.add("comptes_offres");
    const reponse = await POST(requete(evenementAbonnement("customer.subscription.deleted", resilie)));
    expect(reponse.status).toBe(503);
  });

  it("suivi de l'abonnement impossible → 503", async () => {
    stripeDira(abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR }));
    base.enEchec.add("abonnements_stripe");
    const reponse = await POST(
      requete(evenementAbonnement("checkout.session.completed", { subscription: "sub_1", client_reference_id: JOUEUR })),
    );
    expect(reponse.status).toBe(503);
    expect(base.tables.comptes_offres).toHaveLength(0);
  });
});
