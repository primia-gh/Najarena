import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { abonnementStripe, fausseBase, type FausseBase } from "../../tests/fausse-base-stripe";
import { verifierAbonnementsStripe, type ClientAdmin } from "./abonnements-stripe-serveur";

// Vérification quotidienne des abonnements (23/11/2026) : un message du
// webhook perdu ne laisse ni une offre à un abonné qui ne paie plus, ni un
// abonné payant sans son offre. Stripe et la base sont simulés.

const JOUEUR = "11111111-1111-1111-1111-111111111111";
const AUTRE = "22222222-2222-2222-2222-222222222222";
const ADMIN = "99999999-9999-9999-9999-999999999999";

const etatsStripe = new Map<string, ReturnType<typeof abonnementStripe>>();
let stripeEnPanne = false;
const lectures: string[] = [];
const stripe = {
  subscriptions: {
    retrieve: async (id: string) => {
      lectures.push(id);
      if (stripeEnPanne) throw new Error("Stripe ne répond pas");
      const etat = etatsStripe.get(id);
      if (!etat) throw new Error(`abonnement inconnu ${id}`);
      return etat;
    },
  },
} as unknown as Stripe;

let base: FausseBase;
const verifier = (options?: { max?: number }) => verifierAbonnementsStripe(stripe, base as unknown as ClientAdmin, options);

function abonne(profil: string, abonnement: string, statutConnu: string, majLe = "2026-11-01T00:00:00Z") {
  base.tables.abonnements_stripe.push({
    profile_id: profil,
    client_stripe_id: "cus_1",
    abonnement_stripe_id: abonnement,
    statut: statutConnu,
    maj_le: majLe,
  });
}
const offreDe = (profil: string) => base.tables.comptes_offres.find((l) => l.profile_id === profil);

beforeEach(() => {
  base = fausseBase();
  etatsStripe.clear();
  lectures.length = 0;
  stripeEnPanne = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("STRIPE_PRICE_VERIFIE", "price_plus");
  vi.stubEnv("STRIPE_PRICE_ELITE", "price_pro");
  vi.stubEnv("STRIPE_PRICE_ORGANISATEUR", "price_orga");
});

describe("vérification quotidienne des abonnements", () => {
  it("abonnement payé et offre en place : rien ne change, sauf la date de relecture", async () => {
    abonne(JOUEUR, "sub_1", "active");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "verifie", attribue_par: null, attribue_le: "2026-10-01" });
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR }));
    const bilan = await verifier();
    expect(bilan).toMatchObject({ actif: true, examines: 1, accordees: 0, retirees: 0, signales: 0, erreurs: 0 });
    expect(offreDe(JOUEUR)?.attribue_le).toBe("2026-10-01");
    expect(base.tables.abonnements_stripe[0].maj_le).not.toBe("2026-11-01T00:00:00Z");
  });

  it("résiliation dont le message s'est perdu : l'offre est retirée", async () => {
    abonne(JOUEUR, "sub_1", "active");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "elite", attribue_par: null });
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_pro", profileId: JOUEUR }));
    const bilan = await verifier();
    expect(bilan).toMatchObject({ retirees: 1 });
    expect(offreDe(JOUEUR)).toBeUndefined();
    expect(base.tables.abonnements_stripe[0].statut).toBe("canceled");
  });

  it("impayé : l'offre est retirée", async () => {
    abonne(JOUEUR, "sub_1", "active");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "verifie", attribue_par: null });
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "unpaid", prix: "price_plus", profileId: JOUEUR }));
    expect(await verifier()).toMatchObject({ retirees: 1 });
    expect(offreDe(JOUEUR)).toBeUndefined();
  });

  it("paiement dont le message s'est perdu : l'offre est accordée", async () => {
    abonne(JOUEUR, "sub_1", "incomplete");
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "active", prix: "price_orga", profileId: JOUEUR }));
    expect(await verifier()).toMatchObject({ accordees: 1 });
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "organisateur", attribue_par: null });
  });

  it("changement de formule perdu : l'offre suit le prix facturé", async () => {
    abonne(JOUEUR, "sub_1", "active");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "verifie", attribue_par: null });
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "active", prix: "price_pro", profileId: JOUEUR }));
    expect(await verifier()).toMatchObject({ accordees: 1 });
    expect(offreDe(JOUEUR)?.offre).toBe("elite");
  });

  it("une offre donnée à la main par un administrateur n'est jamais retirée", async () => {
    abonne(JOUEUR, "sub_1", "canceled");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "organisateur", attribue_par: ADMIN });
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_plus", profileId: JOUEUR }));
    await verifier();
    expect(offreDe(JOUEUR)).toMatchObject({ offre: "organisateur", attribue_par: ADMIN });
    // Abonnement terminé + offre manuelle : rien à relire chez Stripe.
    expect(lectures).toHaveLength(0);
  });

  it("prix inconnu : signalé, l'offre reste (un mauvais réglage ne vide pas tous les abonnés)", async () => {
    abonne(JOUEUR, "sub_1", "active");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "verifie", attribue_par: null });
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "active", prix: "price_inconnu", profileId: JOUEUR }));
    expect(await verifier()).toMatchObject({ signales: 1, retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("abonnement étiqueté pour un autre compte : signalé, rien n'est touché", async () => {
    abonne(JOUEUR, "sub_1", "active");
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: AUTRE }));
    expect(await verifier()).toMatchObject({ signales: 1, accordees: 0 });
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("Stripe ne répond pas : rien n'est retiré, réessayé au prochain passage", async () => {
    abonne(JOUEUR, "sub_1", "active");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "verifie", attribue_par: null });
    stripeEnPanne = true;
    expect(await verifier()).toMatchObject({ erreurs: 1, retirees: 0 });
    expect(offreDe(JOUEUR)?.offre).toBe("verifie");
  });

  it("écriture impossible : comptée en erreur, sans plantage", async () => {
    abonne(JOUEUR, "sub_1", "active");
    base.tables.comptes_offres.push({ profile_id: JOUEUR, offre: "verifie", attribue_par: null });
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "canceled", prix: "price_plus", profileId: JOUEUR }));
    base.enEchec.add("comptes_offres");
    expect(await verifier()).toMatchObject({ erreurs: 1, retirees: 0 });
  });

  it("abonnement terminé sans offre, ou jamais payé : aucun appel à Stripe", async () => {
    abonne(JOUEUR, "sub_1", "canceled");
    abonne(AUTRE, "sub_2", "incomplete_expired");
    base.tables.abonnements_stripe.push({ profile_id: ADMIN, client_stripe_id: "cus_3", abonnement_stripe_id: null, statut: null });
    expect(await verifier()).toMatchObject({ actif: true, examines: 0 });
    expect(lectures).toHaveLength(0);
  });

  it("les abonnements relus le moins récemment passent d'abord, dans la limite du passage", async () => {
    abonne(JOUEUR, "sub_1", "active", "2026-11-20T00:00:00Z");
    abonne(AUTRE, "sub_2", "active", "2026-11-10T00:00:00Z");
    base.tables.comptes_offres.push(
      { profile_id: JOUEUR, offre: "verifie", attribue_par: null },
      { profile_id: AUTRE, offre: "verifie", attribue_par: null },
    );
    etatsStripe.set("sub_1", abonnementStripe({ id: "sub_1", statut: "active", prix: "price_plus", profileId: JOUEUR }));
    etatsStripe.set("sub_2", abonnementStripe({ id: "sub_2", statut: "active", prix: "price_plus", profileId: AUTRE }));
    expect(await verifier({ max: 1 })).toMatchObject({ examines: 1, restants: true });
    expect(lectures).toEqual(["sub_2"]);
    lectures.length = 0;
    await verifier({ max: 1 });
    expect(lectures).toEqual(["sub_1"]);
  });

  it("sans prix d'offre réglé, ne fait rien", async () => {
    vi.stubEnv("STRIPE_PRICE_VERIFIE", "");
    vi.stubEnv("STRIPE_PRICE_ELITE", "");
    vi.stubEnv("STRIPE_PRICE_ORGANISATEUR", "");
    abonne(JOUEUR, "sub_1", "active");
    expect(await verifier()).toMatchObject({ actif: false });
    expect(lectures).toHaveLength(0);
  });
});
