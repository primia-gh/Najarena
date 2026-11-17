import { clesPubliees } from "@/lib/signature-certificats";
import { reponseApi, reponseOptions } from "@/lib/reponses-publiques";

// Clés publiques qui signent les certificats de niveau (idée en réserve
// n°2) : la première est l'actuelle, les suivantes celles d'avant un
// changement de clé. Base64, Ed25519.
export function GET() {
  const cles = clesPubliees();
  return reponseApi({
    algorithme: "Ed25519",
    cle_actuelle: cles[0] ?? null,
    cles,
  });
}

export function OPTIONS() {
  return reponseOptions();
}
