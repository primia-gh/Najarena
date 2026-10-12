// Typographie française à l'écran : espace insécable avant « : ; ? ! » et à
// l'intérieur des guillemets, pour qu'un signe ne commence jamais une ligne
// ni qu'un guillemet reste seul en fin de ligne (relecture design du
// 11/10/2026) ; entre un nombre et le mot qui le suit (« 300 caractères »,
// « 24 heures », relecture du 12/10/2026).
export function typographie(texte: string): string {
  return texte
    .replace(/ ([:;?!»])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (?=\p{L})/gu, "$1 ");
}
