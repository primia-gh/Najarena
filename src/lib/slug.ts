// U+0300 à U+036F : plage Unicode des signes diacritiques combinants
// (accents), produits par normalize("NFD") — on les retire pour un slug ASCII.
const CODE_DIACRITIQUE_MIN = 0x0300;
const CODE_DIACRITIQUE_MAX = 0x036f;

export function slugifier(texte: string): string {
  const sansAccents = Array.from(texte.normalize("NFD"))
    .filter((car) => {
      const code = car.codePointAt(0) ?? 0;
      return code < CODE_DIACRITIQUE_MIN || code > CODE_DIACRITIQUE_MAX;
    })
    .join("");

  return sansAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
