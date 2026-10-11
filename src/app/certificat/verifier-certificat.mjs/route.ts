import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { URL_SITE } from "@/lib/notifications";

// Le programme de vérification d'un certificat signé (idée en réserve n°2,
// scripts/verifier-certificat.mjs), servi comme celui du registre :
// n'importe qui peut le lire et le lancer avec Node.js, sans le dépôt. Le
// site y inscrit sa propre adresse : le programme relit certificat et clés
// sur le site officiel, jamais sur l'adresse qu'on lui donne (contrôle de
// sécurité du 10/10/2026).
const SITE = new URL(URL_SITE).origin;
const programme = readFile(join(process.cwd(), "scripts/verifier-certificat.mjs"), "utf8").then((texte) =>
  texte.replace('const SITE_INSCRIT = "__SITE_OFFICIEL__";', `const SITE_INSCRIT = ${JSON.stringify(SITE)};`),
);

export async function GET() {
  return new Response(await programme, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Disposition": 'inline; filename="verifier-certificat.mjs"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
