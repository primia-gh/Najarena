// Enregistre les commandes slash (/classement, /tournois, /communaute,
// /lier, /organiser) auprès de Discord — à lancer une fois, puis à
// relancer à chaque ajout de commande (Discord les mémorise ensuite), après
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

// Types d'options Discord : 3 = texte, 4 = nombre entier.
const REGIONS = ["EUW", "EUNE", "TR", "RU", "NA", "BR", "LAN", "LAS", "OCE", "KR", "JP"];

const commandes = [
  { name: "classement", description: "Top 5 du classement League of Legends Najarena" },
  { name: "tournois", description: "Liste les tournois LoL actuellement ouverts sur Najarena" },
  // Espaces communauté (audit N30).
  { name: "communaute", description: "La communauté Najarena de ce serveur : tournois et classement interne" },
  {
    name: "lier",
    description: "Lie ce serveur à une communauté Najarena (code donné sur la page de la communauté)",
    options: [{ type: 3, name: "code", description: "Code de liaison (8 caractères)", required: true }],
  },
  {
    name: "organiser",
    description: "Prépare un tournoi : lien pré-rempli vers Najarena, à relire et valider",
    options: [
      { type: 3, name: "nom", description: "Nom du tournoi", required: true, min_length: 3, max_length: 60 },
      { type: 3, name: "jour", description: "Date, format JJ/MM", required: true },
      { type: 3, name: "heure", description: "Heure de début (heure de Paris), format HH:MM", required: true },
      {
        type: 4,
        name: "places",
        description: "Nombre de places",
        choices: [4, 8, 16, 32, 64].map((n) => ({ name: `${n} places`, value: n })),
      },
      {
        type: 3,
        name: "region",
        description: "Serveur League of Legends",
        choices: REGIONS.map((r) => ({ name: r, value: r })),
      },
    ],
  },
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
