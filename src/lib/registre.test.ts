import { describe, expect, it } from "vitest";
import { doitPublierEmpreinte, empreinteCourte } from "./registre";

describe("registre des points", () => {
  it("publie l'empreinte une fois par soir, et seulement si le registre a changé", () => {
    expect(doitPublierEmpreinte("23:50", false, 12, 10)).toBe(true);
    expect(doitPublierEmpreinte("23:50", false, 12, null)).toBe(true);
    expect(doitPublierEmpreinte("21:00", false, 12, 10)).toBe(false);
    expect(doitPublierEmpreinte("23:50", true, 12, 10)).toBe(false);
    expect(doitPublierEmpreinte("23:50", false, 10, 10)).toBe(false);
    expect(doitPublierEmpreinte("23:50", false, null, null)).toBe(false);
  });

  it("raccourcit une empreinte pour l'affichage", () => {
    expect(empreinteCourte("22facb62a2454882ea35b5a270dcd7a03439936b450aa370913f26a64f768b3f")).toBe("22facb62a245…68b3f");
  });
});
