// Registre ancré sur GitHub (09/10/2026, idée en réserve n°3). L'empreinte
// du soir du registre des points, déjà publiée sur Discord, est aussi
// déposée dans un dépôt GitHub public : un fichier par jour,
// registre/AAAA/MM/AAAA-MM-JJ.json, daté par GitHub au moment du dépôt.
// Deux témoins hors de Najarena valent mieux qu'un : pour retoucher le
// registre sans que cela se voie, il faudrait réécrire les deux.
//
// Configuration (variables d'environnement, jamais dans le dépôt du site) :
//   GITHUB_ANCRAGE_DEPOT  « propriétaire/dépôt », dépôt public dédié ;
//   GITHUB_ANCRAGE_JETON  jeton GitHub limité à ce dépôt, droit
//                         « Contents : read and write » seulement.
// Sans elles, rien n'est envoyé.

export interface ConfigAncrage {
  depot: string;
  jeton: string;
}

export function configAncrage(env: Record<string, string | undefined> = process.env): ConfigAncrage | null {
  const depot = env.GITHUB_ANCRAGE_DEPOT?.trim();
  const jeton = env.GITHUB_ANCRAGE_JETON?.trim();
  if (!depot || !jeton || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(depot)) return null;
  return { depot, jeton };
}

/** Dépôt public affiché sur /registre (le jeton n'est jamais montré). */
export function depotAncrage(env: Record<string, string | undefined> = process.env): string | null {
  return configAncrage(env)?.depot ?? null;
}

/** « registre/2026/10/2026-10-09.json » */
export function cheminFichier(jour: string): string {
  const [annee, mois] = jour.split("-");
  return `registre/${annee}/${mois}/${jour}.json`;
}

export function contenuFichier(d: { jour: string; numero: number; empreinte: string; site: string }): string {
  return `${JSON.stringify(
    {
      registre: "Najarena — registre des points",
      jour: d.jour,
      derniere_ligne: d.numero,
      empreinte: d.empreinte,
      verifier: `${d.site}/registre`,
    },
    null,
    2,
  )}\n`;
}

export function adresseFichier(depot: string, jour: string): string {
  return `https://github.com/${depot}/blob/HEAD/${cheminFichier(jour)}`;
}

export type ResultatAncrage = "depose" | "deja_depose" | "inactif" | "echec";

/**
 * Dépose le fichier du jour. Un fichier déjà présent n'est jamais remplacé
 * (GitHub répond 422 sans l'identifiant de la version existante) : on le
 * compte comme déposé.
 */
export async function deposerEmpreinte(
  d: { jour: string; numero: number; empreinte: string; site: string },
  config: ConfigAncrage | null = configAncrage(),
  envoyer: typeof fetch = fetch,
): Promise<ResultatAncrage> {
  if (!config) return "inactif";
  try {
    const reponse = await envoyer(`https://api.github.com/repos/${config.depot}/contents/${cheminFichier(d.jour)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.jeton}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Registre des points au ${d.jour.split("-").reverse().join("/")} : ligne ${d.numero}`,
        content: Buffer.from(contenuFichier(d), "utf8").toString("base64"),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (reponse.status === 201 || reponse.status === 200) return "depose";
    if (reponse.status === 422) return "deja_depose";
    return "echec";
  } catch {
    return "echec";
  }
}
