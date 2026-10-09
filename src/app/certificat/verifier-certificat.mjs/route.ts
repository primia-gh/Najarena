import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Le programme de vérification d'un certificat signé (idée en réserve n°2,
// scripts/verifier-certificat.mjs), servi tel quel comme celui du registre :
// n'importe qui peut le lire et le lancer avec Node.js, sans le dépôt.
const programme = readFile(join(process.cwd(), "scripts/verifier-certificat.mjs"), "utf8");

export async function GET() {
  return new Response(await programme, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Disposition": 'inline; filename="verifier-certificat.mjs"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
