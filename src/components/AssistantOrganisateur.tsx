"use client";

import { useState, useTransition } from "react";
import { suggererConfigurationTournoi, type SuggestionTournoi } from "@/lib/ia-actions";

// Préremplit le formulaire de /organiser/nouveau à partir d'une description
// en langage naturel — ne soumet jamais rien elle-même, l'organisateur
// revoit et ajuste avant de cliquer "Créer le tournoi". Cible les champs du
// formulaire par id (voir organiser/nouveau/page.tsx) plutôt que de
// transformer toute la page en composant client contrôlé.
export function AssistantOrganisateur() {
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [applique, setApplique] = useState(false);
  const [enCours, demarrer] = useTransition();

  function appliquerSuggestion(suggestion: SuggestionTournoi) {
    const champs: Record<string, string> = {
      nom: suggestion.nom,
      capacite: String(suggestion.capacite),
      region: suggestion.region,
      debute_le: suggestion.debute_le,
      checkin_ouvre_le: suggestion.checkin_ouvre_le,
    };

    for (const [id, valeur] of Object.entries(champs)) {
      const champ = document.getElementById(id) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      if (champ) champ.value = valeur;
    }
  }

  function lancer() {
    setErreur(null);
    setApplique(false);
    demarrer(async () => {
      const resultat = await suggererConfigurationTournoi(description);
      if ("erreur" in resultat) {
        setErreur(resultat.erreur);
        return;
      }
      appliquerSuggestion(resultat.suggestion);
      setApplique(true);
    });
  }

  return (
    <div className="mb-6 rounded-[3px] border border-trait bg-carte p-4">
      <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
        Assistant organisateur (IA)
      </span>
      <p className="mt-1 text-sm text-ardoise">
        Décris ton tournoi, l&apos;assistant préremplit le formulaire
        ci-dessous — à revoir avant de créer.
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Ex. « Samedi soir, une trentaine de joueurs, EUW »"
        className="mt-3 w-full resize-none rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
      />
      {erreur && <p className="mt-2 text-sm text-sceau">{erreur}</p>}
      {applique && !erreur && (
        <p className="mt-2 text-sm text-atteste">
          Formulaire prérempli — vérifie les champs avant de créer le tournoi.
        </p>
      )}
      <button
        type="button"
        onClick={lancer}
        disabled={enCours || description.trim().length < 3}
        className="mt-3 rounded-[3px] border border-trait bg-papier px-4 py-2 text-sm font-semibold text-encre transition hover:border-encre disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enCours ? "Réflexion en cours…" : "Préremplir avec l'IA"}
      </button>
    </div>
  );
}
