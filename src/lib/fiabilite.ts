// Bloc « Fiabilité » du CV (09/10/2026, idée en réserve n°6) : ce qu'une
// équipe regarde avant de recruter — présence au check-in, rapidité à se
// déclarer prêt, forfaits, défaites reconnues. Chiffres comptés par la base
// (fiabilite_joueur, docs/schema.sql) sur les tournois et duels 1v1 ; ce
// fichier ne fait que les mettre en mots. Logique pure, testée dans
// fiabilite.test.ts. Rien n'est affiché sur trop peu de données.

export interface DonneesFiabilite {
  tournois: number;
  checkins: number;
  matchs_prets: number;
  delai_pret_median_secondes: number | null;
  matchs_joues: number;
  forfaits: number;
  defaites_reconnues: number;
}

/** En dessous, une ligne ne dit rien du joueur : elle n'est pas affichée. */
export const MINIMUM_FIABILITE = 3;
/** En dessous, pas de pourcentage : le compte brut seulement. */
export const MINIMUM_PROPORTION = 5;

export interface LigneFiabilite {
  libelle: string;
  valeur: string;
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

/** « moins d'une minute », « 3 min », « 1 h 05 ». */
export function formaterDelai(secondes: number): string {
  if (secondes < 60) return "moins d'une minute";
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function lignesFiabilite(d: DonneesFiabilite): LigneFiabilite[] {
  const lignes: LigneFiabilite[] = [];
  if (d.tournois >= MINIMUM_FIABILITE) {
    lignes.push({
      libelle: "Présent au check-in",
      valeur:
        d.tournois >= MINIMUM_PROPORTION
          ? `${Math.round((d.checkins / d.tournois) * 100)} % des tournois (${d.checkins} sur ${d.tournois})`
          : `${d.checkins} tournoi${d.checkins > 1 ? "s" : ""} sur ${d.tournois}`,
    });
  }
  if (d.matchs_prets >= MINIMUM_FIABILITE && d.delai_pret_median_secondes !== null) {
    lignes.push({
      libelle: "Prêt à jouer",
      valeur: `en ${formaterDelai(d.delai_pret_median_secondes)} après l'ouverture du match (médiane, ${pluriel(d.matchs_prets, "match")})`,
    });
  }
  if (d.matchs_joues >= MINIMUM_FIABILITE) {
    lignes.push({
      libelle: "Forfaits",
      valeur: d.forfaits === 0 ? `aucun sur ${pluriel(d.matchs_joues, "match")}` : `${d.forfaits} sur ${pluriel(d.matchs_joues, "match")}`,
    });
  }
  if (lignes.length > 0 && d.defaites_reconnues > 0) {
    lignes.push({
      libelle: "Défaites reconnues",
      valeur: `${d.defaites_reconnues}, sans attendre la lecture Riot`,
    });
  }
  return lignes;
}
