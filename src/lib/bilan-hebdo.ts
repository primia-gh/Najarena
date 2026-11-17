import { ajouterJours } from "./tournois-auto/creneaux";
import { bornesSemaine } from "./recap-semaine";
import { formaterIndicateur, INDICATEURS, type CleIndicateur, type FormatBilan, type PartieBilan } from "./bilan";

// Bilan de la semaine sur Discord (bilan du joueur, étape 2, 05/10/2026) :
// chaque lundi, en message privé, aux abonnés Elite qui l'ont demandé et
// qui ont joué. Que des chiffres : parties de la semaine, trois indicateurs
// comparés à la semaine d'avant, la règle d'arrêt de l'hygiène de jeu s'il
// y en a une. Aucun texte d'IA, aucune donnée d'un autre joueur. Logique
// pure, testée.

/** Parties qu'il faut, chaque semaine, pour comparer un format d'une semaine à l'autre. */
export const PARTIES_MIN_COMPARAISON_SEMAINE = 3;
const INDICATEURS_SEMAINE: CleIndicateur[] = ["sbires_min", "morts_10min", "degats_min"];
const LIBELLE_FORMAT: Record<FormatBilan, string> = { "1v1": "en 1v1", "5v5": "en tournoi 5v5", classees: "en classée" };

/** Parties jouées dans la semaine qui commence ce lundi (heure de Paris). */
export function partiesDeLaSemaine(parties: PartieBilan[], lundi: string): PartieBilan[] {
  const { debut, fin } = bornesSemaine(lundi);
  return parties.filter((p) => {
    const t = new Date(p.joueLe).getTime();
    return t >= debut.getTime() && t < fin.getTime();
  });
}

function moyenne(parties: PartieBilan[], cle: CleIndicateur): number | null {
  const v = parties.flatMap((p) => {
    const x = p.valeurs[cle];
    return typeof x === "number" && Number.isFinite(x) ? [x] : [];
  });
  return v.length >= PARTIES_MIN_COMPARAISON_SEMAINE ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function jourMois(jour: string): string {
  const [, m, j] = jour.split("-");
  return `${j}/${m}`;
}

export function messageBilanHebdo(entree: {
  lundi: string;
  parties: PartieBilan[];
  regle: string | null;
  lien: string;
}): string | null {
  const cetteSemaine = partiesDeLaSemaine(entree.parties, entree.lundi);
  if (cetteSemaine.length === 0) return null;
  const avant = partiesDeLaSemaine(entree.parties, ajouterJours(entree.lundi, -7));

  const tournoi = cetteSemaine.filter((p) => p.format !== "classees").length;
  const classees = cetteSemaine.length - tournoi;
  const victoires = cetteSemaine.filter((p) => p.gagne).length;
  const detail = [tournoi > 0 ? `${tournoi} en tournoi` : null, classees > 0 ? `${classees} en classée` : null]
    .filter(Boolean)
    .join(", ");
  const lignes = [
    `📊 **Ton bilan de la semaine** (du ${jourMois(entree.lundi)} au ${jourMois(ajouterJours(entree.lundi, 6))})`,
    `${cetteSemaine.length} partie${cetteSemaine.length > 1 ? "s" : ""} vérifiée${cetteSemaine.length > 1 ? "s" : ""} (${detail}) · ${victoires} victoire${victoires > 1 ? "s" : ""}.`,
  ];

  // Comparaison d'une semaine à l'autre dans un même format (les chiffres
  // du 1v1 et de la Faille ne se comparent pas) : le plus joué cette semaine.
  const formats = (["classees", "5v5", "1v1"] as const)
    .map((f) => ({ f, ici: cetteSemaine.filter((p) => p.format === f), la: avant.filter((p) => p.format === f) }))
    .filter((x) => x.ici.length >= PARTIES_MIN_COMPARAISON_SEMAINE && x.la.length >= PARTIES_MIN_COMPARAISON_SEMAINE)
    .sort((a, b) => b.ici.length - a.ici.length);
  const retenu = formats[0];
  if (retenu) {
    lignes.push(`Comparé à la semaine d'avant, ${LIBELLE_FORMAT[retenu.f]} :`);
    for (const cle of INDICATEURS_SEMAINE) {
      const ici = moyenne(retenu.ici, cle);
      const la = moyenne(retenu.la, cle);
      if (ici === null || la === null) continue;
      const evolution = (INDICATEURS[cle].sens * (ici - la)) / Math.max(Math.abs(la), 0.01);
      const fleche = evolution > 0.03 ? "↗" : evolution < -0.03 ? "↘" : "→";
      lignes.push(
        `${fleche} ${INDICATEURS[cle].libelle} : ${formaterIndicateur(cle, ici)} (contre ${formaterIndicateur(cle, la)})`,
      );
    }
  }
  if (entree.regle) lignes.push(`⏱️ ${entree.regle}`);
  lignes.push(`Ton bilan complet : ${entree.lien}`);
  return lignes.join("\n");
}
