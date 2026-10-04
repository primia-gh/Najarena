import { describe, expect, it } from "vitest";
import { cleVirement, codePaysVersement, compteStripeVerifie, groupeVirement } from "./versements-stripe";

const verifie = {
  details_submitted: true,
  payouts_enabled: true,
  capabilities: { transfers: "active" },
  requirements: { currently_due: [], disabled_reason: null },
};

describe("compteStripeVerifie", () => {
  it("vrai seulement quand Stripe a tout vérifié", () => {
    expect(compteStripeVerifie(verifie)).toBe(true);
  });

  it("faux tant qu'il manque une pièce, un compte bancaire ou la capacité de virement", () => {
    expect(compteStripeVerifie({ ...verifie, details_submitted: false })).toBe(false);
    expect(compteStripeVerifie({ ...verifie, payouts_enabled: false })).toBe(false);
    expect(compteStripeVerifie({ ...verifie, capabilities: { transfers: "pending" } })).toBe(false);
    expect(compteStripeVerifie({ ...verifie, requirements: { currently_due: ["individual.verification.document"] } })).toBe(false);
    expect(compteStripeVerifie({ ...verifie, requirements: { disabled_reason: "rejected.fraud" } })).toBe(false);
    expect(compteStripeVerifie({})).toBe(false);
  });
});

describe("virements", () => {
  it("une clé par gain, un groupe par tournoi", () => {
    expect(cleVirement("t1", "p1")).toBe("dotation:t1:p1");
    expect(cleVirement("t1", "p1")).not.toBe(cleVirement("t1", "p2"));
    expect(groupeVirement("t1")).toBe("dotation_t1");
  });

  it("pays de résidence acceptés", () => {
    expect(codePaysVersement("BE")).toBe("BE");
    expect(codePaysVersement("US")).toBeNull();
    expect(codePaysVersement("")).toBeNull();
  });
});
