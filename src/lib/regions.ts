export interface Region {
  code: string;
  nom: string;
}

// Serveurs League of Legends — même liste utilisée pour lier un Riot ID
// (src/lib/riot.ts, qui ajoute le routage API) et pour créer un tournoi.
export const REGIONS: Region[] = [
  { code: "EUW", nom: "Europe de l'Ouest (EUW)" },
  { code: "EUNE", nom: "Europe du Nord-Est (EUNE)" },
  { code: "TR", nom: "Turquie" },
  { code: "RU", nom: "Russie" },
  { code: "NA", nom: "Amérique du Nord" },
  { code: "BR", nom: "Brésil" },
  { code: "LAN", nom: "Amérique latine Nord" },
  { code: "LAS", nom: "Amérique latine Sud" },
  { code: "OCE", nom: "Océanie" },
  { code: "KR", nom: "Corée" },
  { code: "JP", nom: "Japon" },
];
