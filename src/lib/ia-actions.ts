"use server";

import { createClient } from "@/lib/supabase/server";
import { heureParis, jourParis } from "@/lib/tournois-auto/creneaux";
import { demanderJson, iaDisponible } from "@/lib/claude";
import {
  construireDemandeConfiguration,
  SCHEMA_CONFIGURATION,
  validerConfiguration,
  type SuggestionTournoi,
} from "@/lib/assistant-organisateur";

// Assistant organisateur (IA) — demandé le 2026-09-12, choisi par le porteur
// du projet comme première fonctionnalité IA concrète. Aide à la
// CONFIGURATION d'un tournoi à partir d'une description en langage naturel —
// ne crée jamais le tournoi lui-même, se contente de préremplir le formulaire
// que l'organisateur revoit et soumet lui-même (mêmes règles de validation
// que creerTournoi côté serveur, jamais une confiance aveugle dans la
// réponse du modèle). Depuis le 03/10/2026, passe par le module commun
// src/lib/claude.ts (même modèle, réponse JSON contrainte, description
// passée comme une donnée) — logique dans src/lib/assistant-organisateur.ts.

export type { SuggestionTournoi };

export type ResultatSuggestion = { suggestion: SuggestionTournoi } | { erreur: string };

// 10 demandes par 24 heures et par compte : chaque demande est un appel
// payant à l'API (audit F2). Même valeur que reserver_appel_assistant_ia
// (docs/schema.sql), qui applique la limite.
const LIMITE_ASSISTANT_IA = 10;
const LONGUEUR_MAX_DESCRIPTION = 500;

const ERREUR_GENERIQUE = "Assistant IA indisponible pour l'instant.";
const ERREUR_CONFIGURATION_INVALIDE =
  "L'assistant a proposé une configuration invalide, réessaie ou remplis le formulaire toi-même.";

export async function suggererConfigurationTournoi(description: string): Promise<ResultatSuggestion> {
  if (!iaDisponible()) {
    return { erreur: ERREUR_GENERIQUE };
  }

  // Une Server Action est appelable directement, sans passer par la page qui
  // la porte : sans ce contrôle, n'importe qui pourrait consommer le crédit
  // de l'API Anthropic. Même règle que les autres actions (session requise).
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { erreur: "Connecte-toi pour utiliser l'assistant." };
  }

  const texte = description.trim();
  if (texte.length < 3) {
    return { erreur: 'Décris ton tournoi d\'abord (ex. "samedi soir, une trentaine de joueurs, EUW").' };
  }
  if (texte.length > LONGUEUR_MAX_DESCRIPTION) {
    return { erreur: `Description trop longue : ${LONGUEUR_MAX_DESCRIPTION} caractères au plus.` };
  }

  const { data: autorise, error: erreurLimite } = await supabase.rpc("reserver_appel_assistant_ia");
  if (erreurLimite) {
    return { erreur: ERREUR_GENERIQUE };
  }
  if (!autorise) {
    return {
      erreur: `Tu as utilisé tes ${LIMITE_ASSISTANT_IA} demandes à l'assistant des dernières 24 heures : remplis le formulaire toi-même, ou réessaie demain.`,
    };
  }

  // L'IA propose une date plausible, jamais engageante : l'organisateur la
  // revoit et l'ajuste avant de soumettre. Date donnée en heure de Paris,
  // comme les champs du formulaire (lib/tournoi-actions.ts les lit ainsi) —
  // en UTC, « ce soir » pouvait tomber le lendemain.
  const maintenant = new Date();
  const maintenantParis = `${jourParis(maintenant)} ${heureParis(maintenant.toISOString())}`;

  const resultat = await demanderJson({
    ...construireDemandeConfiguration(texte, maintenantParis),
    schema: SCHEMA_CONFIGURATION,
    valider: validerConfiguration,
  });
  if (resultat.ok) return { suggestion: resultat.valeur };
  return { erreur: resultat.raison === "invalide" ? ERREUR_CONFIGURATION_INVALIDE : ERREUR_GENERIQUE };
}
