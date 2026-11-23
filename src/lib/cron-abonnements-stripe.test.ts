import { beforeEach, describe, expect, it, vi } from "vitest";

// Route de la vérification quotidienne des abonnements
// (src/app/api/cron/abonnements-stripe/route.ts) : authentification,
// Stripe pas encore activé, base indisponible, bilan renvoyé.

const verifierAbonnementsStripe = vi.fn();
let adminDisponible = true;

vi.mock("stripe", () => ({ default: class {} }));
vi.mock("@/lib/supabase/admin", () => ({ creerClientAdmin: () => (adminDisponible ? {} : null) }));
vi.mock("@/lib/abonnements-stripe-serveur", () => ({ verifierAbonnementsStripe }));

const { GET } = await import("@/app/api/cron/abonnements-stripe/route");

const appel = (jeton?: string) =>
  GET(new Request("http://localhost/api/cron/abonnements-stripe", { headers: jeton ? { authorization: `Bearer ${jeton}` } : {} }));

beforeEach(() => {
  verifierAbonnementsStripe.mockReset();
  adminDisponible = true;
  vi.stubEnv("CRON_SECRET", "secret-cron");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_faux");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("route de la vérification quotidienne des abonnements", () => {
  it("sans CRON_SECRET réglé : 503, rien n'est relu", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await appel("secret-cron")).status).toBe(503);
    expect(verifierAbonnementsStripe).not.toHaveBeenCalled();
  });

  it("sans jeton ou avec un mauvais jeton : 401", async () => {
    expect((await appel()).status).toBe(401);
    expect((await appel("autre")).status).toBe(401);
    expect(verifierAbonnementsStripe).not.toHaveBeenCalled();
  });

  it("Stripe pas encore activé : ne fait rien", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const reponse = await appel("secret-cron");
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ actif: false, raison: "Stripe pas encore activé." });
    expect(verifierAbonnementsStripe).not.toHaveBeenCalled();
  });

  it("base indisponible : 503", async () => {
    adminDisponible = false;
    expect((await appel("secret-cron")).status).toBe(503);
  });

  it("relit les abonnements dans le temps imparti et renvoie le bilan ; une correction est notée au journal", async () => {
    const bilan = { actif: true, examines: 3, accordees: 0, retirees: 1, signales: 0, erreurs: 0, restants: false };
    verifierAbonnementsStripe.mockResolvedValue(bilan);
    const avant = Date.now();
    const reponse = await appel("secret-cron");
    expect(await reponse.json()).toEqual(bilan);
    const options = verifierAbonnementsStripe.mock.calls[0][2];
    expect(options.max).toBe(100);
    expect(options.finAu).toBeGreaterThanOrEqual(avant + 45_000);
    expect(options.finAu).toBeLessThan(avant + 60_000);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("rien à corriger : rien au journal d'erreurs", async () => {
    verifierAbonnementsStripe.mockResolvedValue({ actif: true, examines: 2, accordees: 0, retirees: 0, signales: 0, erreurs: 0, restants: false });
    await appel("secret-cron");
    expect(console.error).not.toHaveBeenCalled();
  });
});
