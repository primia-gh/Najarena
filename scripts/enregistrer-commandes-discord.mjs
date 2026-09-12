// Enregistre les commandes slash /classement et /tournois auprès de
// Discord — à lancer UNE SEULE FOIS (Discord les mémorise ensuite), après
// avoir créé l'application sur discord.com/developers/applications et
// renseigné DISCORD_APPLICATION_ID (page "General Information") et
// DISCORD_BOT_TOKEN (page "Bot" > Reset Token) dans .env.local.
//
// Usage : npm run discord:commandes

import { readFileSync } from "node:fs";

function lireEnvLocal() {
  const contenu = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  const valeurs = {};
  for (const ligne of contenu.split("\n")) {
    const correspondance = ligne.match(/^([A-Z_]+)=(.*)$/);
    if (correspondance) valeurs[correspondance[1]] = correspondance[2].trim();
  }
  return valeurs;
}

const env = lireEnvLocal();
const applicationId = env.DISCORD_APPLICATION_ID;
const botToken = env.DISCORD_BOT_TOKEN;

if (!applicationId || !botToken) {
  console.error(
    "DISCORD_APPLICATION_ID et DISCORD_BOT_TOKEN doivent être renseignés dans .env.local avant de lancer ce script.",
  );
  process.exit(1);
}

const commandes = [
  { name: "classement", description: "Top 5 du classement League of Legends Najarena" },
  { name: "tournois", description: "Liste les tournois LoL actuellement ouverts sur Najarena" },
];

const reponse = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commandes),
});

if (!reponse.ok) {
  console.error(`Échec (${reponse.status}) :`, await reponse.text());
  process.exit(1);
}

console.log(`${commandes.length} commande(s) enregistrée(s) avec succès — disponibles dans quelques minutes sur le serveur.`);
