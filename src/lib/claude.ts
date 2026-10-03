// Appels à Claude côté serveur (03/10/2026, audit N25, N28, N29) : revue de
// match écrite, dossier de litige, recherche de joueurs en langage naturel.
// Jamais depuis le navigateur : la clé ANTHROPIC_API_KEY reste sur le
// serveur, comme la clé Riot (CLAUDE.md §6).
//
// Réglages communs :
// - réponse en JSON contraint par un schéma (structured outputs), puis
//   revérifiée par l'appelant (`valider`) : jamais une confiance aveugle ;
// - effort « low » : textes courts, données déjà mâchées ;
// - repli automatique si un filtre de sécurité refuse la demande
//   (fallbacks « default ») ;
// - aucune décision : ces textes aident un humain, ils ne tranchent rien.

import Anthropic from "@anthropic-ai/sdk";

export const MODELE_IA = "claude-opus-5-5";

export type ResultatIA<T> = { ok: true; valeur: T } | { ok: false; raison: "indisponible" | "refus" | "invalide" };

let client: Anthropic | null = null;

function clientAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

export function iaDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

interface DemandeJson<T> {
  systeme: string;
  contenu: string;
  schema: Record<string, unknown>;
  /** Revérifie la réponse (types, longueurs, valeurs permises) ; null si invalide. */
  valider: (donnees: unknown) => T | null;
}

export async function demanderJson<T>({ systeme, contenu, schema, valider }: DemandeJson<T>): Promise<ResultatIA<T>> {
  const anthropic = clientAnthropic();
  if (!anthropic) return { ok: false, raison: "indisponible" };

  try {
    const reponse = await anthropic.beta.messages.create({
      model: MODELE_IA,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: systeme,
      messages: [{ role: "user", content: contenu }],
    });

    if (reponse.stop_reason === "refusal") return { ok: false, raison: "refus" };
    if (reponse.stop_reason !== "end_turn") return { ok: false, raison: "invalide" };

    const texte = reponse.content.flatMap((bloc) => (bloc.type === "text" ? [bloc.text] : [])).join("");
    const valeur = valider(JSON.parse(texte));
    return valeur === null ? { ok: false, raison: "invalide" } : { ok: true, valeur };
  } catch (erreur) {
    if (erreur instanceof SyntaxError) return { ok: false, raison: "invalide" };
    if (erreur instanceof Anthropic.APIError) {
      console.error(`Claude : erreur ${erreur.status ?? "réseau"} (${erreur.message})`);
    }
    return { ok: false, raison: "indisponible" };
  }
}

/** Texte d'une liste de chaînes non vides, bornée en nombre et en longueur. */
export function listeDeTextes(valeur: unknown, min: number, max: number, longueurMax: number): string[] | null {
  if (!Array.isArray(valeur) || valeur.length < min || valeur.length > max) return null;
  const textes = valeur.map((v) => (typeof v === "string" ? v.trim() : ""));
  return textes.every((t) => t.length > 0 && t.length <= longueurMax) ? textes : null;
}
