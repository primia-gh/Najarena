import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Le programme de vérification indépendante (scripts/verifier-registre.mjs),
// servi tel quel : le dépôt du site n'a pas besoin d'être public pour que
// n'importe qui puisse le lire et le lancer.
const programme = readFile(join(process.cwd(), "scripts/verifier-registre.mjs"), "utf8");

export async function GET() {
  return new Response(await programme, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Disposition": 'inline; filename="verifier-registre.mjs"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
