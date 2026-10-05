import { describe, expect, it } from "vitest";
import {
  championDe,
  construireDonneesJeu,
  estObjetDeBuild,
  objetDe,
  runeDe,
  sortDe,
  type FichierChampions,
  type FichierObjets,
  type FichierRunes,
  type FichierSorts,
} from "./ddragon";

// Extraits des fichiers Data Dragon (fr_FR), réduits aux champs lus.
const champions: FichierChampions = {
  data: {
    Ahri: { id: "Ahri", key: "103", name: "Ahri", image: { full: "Ahri.png" } },
    MonkeyKing: { id: "MonkeyKing", key: "62", name: "Wukong", image: { full: "MonkeyKing.png" } },
    Piege: { id: "Piege", key: "999", name: "Piège", image: { full: "../../ailleurs.png" } },
  },
};
const objets: FichierObjets = {
  data: {
    "6655": { name: "Compagnon de Luden", image: { full: "6655.png" }, tags: ["SpellDamage"], gold: { total: 2900 } },
    "2003": { name: "Potion de soins", image: { full: "2003.png" }, tags: ["Consumable"], consumed: true, gold: { total: 50 } },
    "3340": { name: "Totem de vision", image: { full: "3340.png" }, tags: ["Trinket", "Vision"], gold: { total: 0 } },
    "2055": { name: "Balise de contrôle", image: { full: "2055.png" }, tags: ["Vision"], gold: { total: 75 } },
  },
};
const runes: FichierRunes = [
  {
    id: 8100,
    name: "Domination",
    icon: "perk-images/Styles/7200_Domination.png",
    slots: [{ runes: [{ id: 8112, name: "Électrocution", icon: "perk-images/Styles/Domination/Electrocute/Electrocute.png" }] }],
  },
];
const sorts: FichierSorts = {
  data: { SummonerFlash: { key: "4", name: "Saut éclair", image: { full: "SummonerFlash.png" } } },
};

const donnees = construireDonneesJeu("15.19.1", champions, objets, runes, sorts);

describe("Data Dragon", () => {
  it("donne le nom français et l'icône d'un champion, par numéro ou par nom interne", () => {
    expect(championDe(donnees, "Ahri", 103)).toEqual({
      nom: "Ahri",
      image: "https://ddragon.leagueoflegends.com/cdn/15.19.1/img/champion/Ahri.png",
    });
    expect(championDe(donnees, "MonkeyKing", null).nom).toBe("Wukong");
    expect(championDe(donnees, "monkeyking", null).nom).toBe("Wukong");
    expect(championDe(null, "Ahri", 103)).toEqual({ nom: "Ahri", image: null });
  });

  it("n'accepte que des noms de fichiers attendus : une image reste toujours chez Riot", () => {
    expect(championDe(donnees, "Piege", 999).image).toBeNull();
  });

  it("objets, runes et sorts, avec un libellé neutre s'ils sont inconnus", () => {
    expect(objetDe(donnees, 6655)).toMatchObject({ nom: "Compagnon de Luden", build: true });
    expect(objetDe(donnees, 6655).image).toBe("https://ddragon.leagueoflegends.com/cdn/15.19.1/img/item/6655.png");
    expect(objetDe(donnees, 1234)).toEqual({ nom: "Objet n° 1234", image: null, inconnu: true });
    expect(runeDe(donnees, 8112)).toEqual({
      nom: "Électrocution",
      image: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png",
    });
    expect(runeDe(donnees, "8100").nom).toBe("Domination");
    expect(sortDe(donnees, 4)).toEqual({
      nom: "Saut éclair",
      image: "https://ddragon.leagueoflegends.com/cdn/15.19.1/img/spell/SummonerFlash.png",
    });
    expect(sortDe(null, 4)).toEqual({ nom: "Sort n° 4", image: null, inconnu: true });
  });

  it("écarte potions, balises et totems d'un build, même sans Data Dragon", () => {
    expect(estObjetDeBuild(donnees, 6655)).toBe(true);
    expect(estObjetDeBuild(donnees, 2003)).toBe(false);
    expect(estObjetDeBuild(donnees, 3340)).toBe(false);
    expect(estObjetDeBuild(donnees, 2055)).toBe(false);
    expect(estObjetDeBuild(null, 2003)).toBe(false);
    expect(estObjetDeBuild(null, 6655)).toBe(true);
  });
});
