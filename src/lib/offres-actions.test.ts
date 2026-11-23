import { beforeEach, describe, expect, it, vi } from "vitest";
import { fausseBase, type FausseBase } from "../../tests/fausse-base-stripe";

// Attribution manuelle d'une offre (/admin) : refusée pour un joueur abonné
// chez Stripe (contrôle de sécurité du 23/11/2026) — son offre suit son
// abonnement ; une offre offerte resterait à vie après un remboursement, et
// une révocation serait défaite par la vérification quotidienne.

const ADMIN = "99999999-9999-9999-9999-999999999999";
const JOUEUR = "11111111-1111-1111-1111-111111111111";
let base: FausseBase;
let abonnementsChezStripe: { status: string; metadata: Record<string, string> }[] = [];
let stripeEnPanne = false;

vi.mock("stripe", () => ({
  default: class {
    subscriptions = {
      list: async () => {
        if (stripeEnPanne) throw new Error("Stripe ne répond pas");
        return { data: abonnementsChezStripe };
      },
    };
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (adresse: string) => {
    throw new Error(`redirection:${adresse}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ADMIN } } }) },
    from: (table: string) => base.from(table),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ creerClientAdmin: () => base }));

const { attribuerOffreAdmin } = await import("./offres-actions");

function formulaire(offre: string) {
  const donnees = new FormData();
  donnees.set("pseudo", "Joueur");
  donnees.set("offre", offre);
  return donnees;
}
async function redirection(offre: string): Promise<string> {
  try {
    await attribuerOffreAdmin(formulaire(offre));
  } catch (erreur) {
    return decodeURIComponent((erreur as Error).message);
  }
  return "aucune";
}

beforeEach(() => {
  base = fausseBase();
  abonnementsChezStripe = [];
  stripeEnPanne = false;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_faux");
  base.tables.admins = [{ profile_id: ADMIN }];
  base.tables.profiles = [{ id: JOUEUR, pseudo: "Joueur" }];
});

describe("attribuerOffreAdmin", () => {
  it("offre une offre à un joueur sans abonnement, notée comme donnée à la main", async () => {
    expect(await redirection("organisateur")).toContain("/admin?message=");
    expect(base.tables.comptes_offres[0]).toMatchObject({ profile_id: JOUEUR, offre: "organisateur", attribue_par: ADMIN });
  });

  it("joueur dont l'abonnement est terminé, chez Stripe aussi : l'offre peut être offerte", async () => {
    base.tables.abonnements_stripe.push({ profile_id: JOUEUR, client_stripe_id: "cus_1", statut: "canceled" });
    abonnementsChezStripe = [{ status: "canceled", metadata: { profile_id: JOUEUR } }];
    expect(await redirection("verifie")).toContain("/admin?message=");
  });

  it("abonnement inconnu de la base (message de paiement perdu) mais en vie chez Stripe : refusé", async () => {
    base.tables.abonnements_stripe.push({ profile_id: JOUEUR, client_stripe_id: "cus_1", statut: null });
    abonnementsChezStripe = [{ status: "active", metadata: { profile_id: JOUEUR } }];
    expect(await redirection("organisateur")).toContain("abonnement Stripe en cours");
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("Stripe ne répond pas : refusé, rien n'est écrit", async () => {
    base.tables.abonnements_stripe.push({ profile_id: JOUEUR, client_stripe_id: "cus_1", statut: null });
    stripeEnPanne = true;
    expect(await redirection("organisateur")).toContain("Impossible de vérifier");
    expect(base.tables.comptes_offres).toHaveLength(0);
  });

  it("un abonnement créé hors du site (sans étiquette) ne bloque pas", async () => {
    base.tables.abonnements_stripe.push({ profile_id: JOUEUR, client_stripe_id: "cus_1", statut: null });
    abonnementsChezStripe = [{ status: "active", metadata: {} }];
    expect(await redirection("verifie")).toContain("/admin?message=");
  });

  it("joueur abonné chez Stripe : ni offre offerte, ni révocation", async () => {
    for (const statut of ["active", "trialing", "past_due", "unpaid", "incomplete"]) {
      base.tables.abonnements_stripe = [{ profile_id: JOUEUR, client_stripe_id: "cus_1", statut }];
      base.tables.comptes_offres = [{ profile_id: JOUEUR, offre: "verifie", attribue_par: null }];
      expect(await redirection("organisateur")).toContain("abonnement Stripe en cours");
      expect(await redirection("gratuit")).toContain("abonnement Stripe en cours");
      expect(base.tables.comptes_offres).toEqual([{ profile_id: JOUEUR, offre: "verifie", attribue_par: null }]);
    }
  });
});
