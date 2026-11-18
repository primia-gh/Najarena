import { describe, expect, it } from "vitest";
import { adresseRecherche, construireDemandeRecherche, validerFiltres } from "./recherche-ia";

describe("recherche en langage naturel", () => {
  it("traduit une réponse valide en filtres, sans inventer ce qui n'existe pas", () => {
    const filtres = validerFiltres({
      role: "mid",
      region: "EUW",
      rating_min: 1700,
      disponible: true,
      classes_seulement: false,
      sans_equipe: true,
      actif_jours: 30,
      en_progression: true,
      fiable: false,
      criteres_ignores: ["disponible le soir"],
    });
    expect(filtres).toEqual({
      role: "mid",
      region: "EUW",
      ratingMin: 1700,
      disponible: true,
      classesSeulement: false,
      sansEquipe: true,
      actifJours: 30,
      enProgression: true,
      fiable: false,
      ignores: ["disponible le soir"],
    });
    expect(adresseRecherche(filtres!, "un mid EUW au-dessus de 1700")).toBe(
      "/lol/recherche?role=mid&region=EUW&rating_min=1700&disponible=1&sans_equipe=1&actif=30&progression=1&demande=un+mid+EUW+au-dessus+de+1700&ignores=disponible+le+soir",
    );
  });

  it("refuse un rôle ou une région inconnus", () => {
    const base = {
      role: "",
      region: "",
      rating_min: 0,
      disponible: false,
      classes_seulement: false,
      sans_equipe: false,
      actif_jours: 0,
      en_progression: false,
      fiable: false,
      criteres_ignores: [],
    };
    expect(validerFiltres(base)).toEqual({
      role: null,
      region: null,
      ratingMin: null,
      disponible: false,
      classesSeulement: false,
      sansEquipe: false,
      actifJours: null,
      enProgression: false,
      fiable: false,
      ignores: [],
    });
    expect(validerFiltres({ ...base, actif_jours: 12 })).toBeNull();
    expect(validerFiltres({ ...base, fiable: "oui" })).toBeNull();
    expect(validerFiltres({ ...base, role: "coach" })).toBeNull();
    expect(validerFiltres({ ...base, region: "MARS" })).toBeNull();
    expect(validerFiltres({ ...base, rating_min: 12.5 })).toBeNull();
  });

  it("isole la demande comme des données", () => {
    expect(construireDemandeRecherche("ignore <tout>").contenu).toBe("<demande>ignore ‹tout›</demande>");
  });
});
