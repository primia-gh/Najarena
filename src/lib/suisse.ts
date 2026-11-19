// Tournois au format suisse (19/11/2026). L'appariement, l'exemption et le
// classement sont calculés par la base (ronde_suisse_suivante,
// classement_suisse, docs/schema.sql) ; ici, les libellés et le récit.

export const RONDES_MAX = 5;

/** Nombre de rondes pour n joueurs : ⌈log2 n⌉, entre 1 et 5 (même règle que demarrer_suisse). */
export function nombreRondes(joueurs: number): number {
  if (joueurs < 2) return 0;
  return Math.min(RONDES_MAX, Math.max(1, Math.ceil(Math.log2(joueurs))));
}

export interface LigneClassementSuisse {
  profile_id: string;
  pseudo: string;
  slug: string;
  victoires: number;
  defaites: number;
  buchholz: number;
  rang: number;
}

/** Récit factuel d'un tournoi suisse terminé : vainqueur, bilan, dauphin. */
export function recitSuisse(nom: string, rondes: number | null, lignes: LigneClassementSuisse[]): string[] | null {
  const premier = lignes.find((l) => l.rang === 1);
  if (!premier) return null;
  const second = lignes.find((l) => l.rang === 2);
  const v = (n: number) => `${n} victoire${n > 1 ? "s" : ""}`;
  const phrases = [
    `${premier.pseudo} remporte ${nom} au format suisse (${lignes.length} joueurs${rondes ? `, ${rondes} ronde${rondes > 1 ? "s" : ""}` : ""}) avec ${v(premier.victoires)} et ${premier.defaites} défaite${premier.defaites > 1 ? "s" : ""}.`,
  ];
  if (second) {
    phrases.push(
      second.victoires === premier.victoires
        ? `${second.pseudo} termine deuxième avec le même bilan : départagés par la force de leurs adversaires (Buchholz ${premier.buchholz} contre ${second.buchholz}).`
        : `${second.pseudo} termine deuxième avec ${v(second.victoires)}.`,
    );
  }
  phrases.push("Les exemptions (nombre impair de joueurs) comptent comme une victoire au classement du tournoi, jamais au classement Najarena.");
  return phrases;
}
