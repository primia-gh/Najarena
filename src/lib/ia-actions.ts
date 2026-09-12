"use server";

import { REGIONS } from "@/lib/regions";

// Assistant organisateur (IA) — demandé le 2026-09-12, choisi par le porteur
// du projet comme première fonctionnalité IA concrète (les autres pistes de
// l'audit, détection d'anomalie et résumé de match, sont bloquées sur un
// vrai volume de matchs / une clé Riot production). Aide à la CONFIGURATION
// d'un tournoi à partir d'une description en langage naturel — ne crée
// jamais le tournoi lui-même, se contente de préremplir le formulaire que
// l'organisateur revoit et soumet lui-même (mêmes règles de validation que
// creerTournoi côté serveur, jamais une confiance aveugle dans la réponse
// du modèle).
const cleAnthropic = process.env.ANTHROPIC_API_KEY;

const CAPACITES_VALIDES = [4, 8, 16, 32, 64] as const;
const REGIONS_VALIDES = REGIONS.map((r) => r.code);

export interface SuggestionTournoi {
  nom: string;
  capacite: (typeof CAPACITES_VALIDES)[number];
  region: string;
  debute_le: string;
  checkin_ouvre_le: string;
}

export type ResultatSuggestion = { suggestion: SuggestionTournoi } | { erreur: string };

interface BlocContenuAnthropic {
  type: string;
  input?: Record<string, unknown>;
}

interface ReponseAnthropic {
  content: BlocContenuAnthropic[];
}

const ERREUR_GENERIQUE = "Assistant IA indisponible pour l'instant.";
const ERREUR_CONFIGURATION_INVALIDE = "L'assistant a proposé une configuration invalide, réessaie ou remplis le formulaire toi-même.";

export async function suggererConfigurationTournoi(description: string): Promise<ResultatSuggestion> {
  if (!cleAnthropic) {
    return { erreur: ERREUR_GENERIQUE };
  }

  const texte = description.trim();
  if (texte.length < 3) {
    return { erreur: "Décris ton tournoi d'abord (ex. \"samedi soir, une trentaine de joueurs, EUW\")." };
  }

  // L'heure "actuelle" et le fuseau du navigateur de l'organisateur ne sont
  // pas connus côté serveur — l'IA propose une date plausible, jamais
  // engageante : l'organisateur la revoit et l'ajuste avant de soumettre.
  const maintenant = new Date();

  try {
    const reponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": cleAnthropic,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: `Tu configures un tournoi League of Legends 1v1 sur Najarena à partir d'une description en langage naturel écrite par l'organisateur. Date actuelle : ${maintenant.toISOString()} (propose toujours une date future). Régions valides (codes serveur Riot) : ${REGIONS_VALIDES.join(", ")} — choisis "EUW" si rien n'est précisé. La capacité doit être exactement 4, 8, 16 ou 64 : arrondis le nombre de joueurs mentionné à la puissance de 2 immédiatement supérieure ou égale (ex. "une vingtaine de joueurs" → 32). L'ouverture du check-in doit précéder le début de 15 à 30 minutes. Si aucune heure n'est précisée, choisis 20:00 (créneau le plus courant sur la plateforme). Le nom doit faire entre 3 et 60 caractères.`,
        messages: [{ role: "user", content: texte }],
        tools: [
          {
            name: "proposer_configuration",
            description: "Propose les champs du formulaire de création de tournoi Najarena.",
            input_schema: {
              type: "object",
              properties: {
                nom: { type: "string" },
                capacite: { type: "integer", enum: CAPACITES_VALIDES },
                region: { type: "string", enum: REGIONS_VALIDES },
                debute_le: {
                  type: "string",
                  description: "Date et heure de début, format YYYY-MM-DDTHH:mm",
                },
                checkin_ouvre_le: {
                  type: "string",
                  description: "Date et heure d'ouverture du check-in, format YYYY-MM-DDTHH:mm, avant debute_le",
                },
              },
              required: ["nom", "capacite", "region", "debute_le", "checkin_ouvre_le"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "proposer_configuration" },
      }),
    });

    if (!reponse.ok) {
      return { erreur: ERREUR_GENERIQUE };
    }

    const donnees = (await reponse.json()) as ReponseAnthropic;
    const blocOutil = donnees.content.find((b) => b.type === "tool_use");
    if (!blocOutil?.input) {
      return { erreur: ERREUR_CONFIGURATION_INVALIDE };
    }

    const brut = blocOutil.input;

    const capacite = Number(brut.capacite);
    if (!(CAPACITES_VALIDES as readonly number[]).includes(capacite)) {
      return { erreur: ERREUR_CONFIGURATION_INVALIDE };
    }

    const region = String(brut.region ?? "");
    if (!REGIONS_VALIDES.includes(region)) {
      return { erreur: ERREUR_CONFIGURATION_INVALIDE };
    }

    const nom = String(brut.nom ?? "").trim().slice(0, 60);
    if (nom.length < 3) {
      return { erreur: ERREUR_CONFIGURATION_INVALIDE };
    }

    const debuteLe = String(brut.debute_le ?? "");
    const checkinOuvreLe = String(brut.checkin_ouvre_le ?? "");
    if (Number.isNaN(new Date(debuteLe).getTime()) || Number.isNaN(new Date(checkinOuvreLe).getTime())) {
      return { erreur: ERREUR_CONFIGURATION_INVALIDE };
    }

    return {
      suggestion: {
        nom,
        capacite: capacite as SuggestionTournoi["capacite"],
        region,
        debute_le: debuteLe.slice(0, 16),
        checkin_ouvre_le: checkinOuvreLe.slice(0, 16),
      },
    };
  } catch {
    return { erreur: ERREUR_GENERIQUE };
  }
}
