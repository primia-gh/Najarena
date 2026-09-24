"use client";

import { useState, useTransition } from "react";
import { suggererConfigurationTournoi, type SuggestionTournoi } from "@/lib/ia-actions";

// Propose une configuration à partir d'une description en langage naturel,
// affichée en carte : rien n'est écrit dans le formulaire de
// /organiser/nouveau tant que l'organisateur n'a pas cliqué "Appliquer" —
// "voici ce que je vais faire", jamais une action en silence. Ne soumet
// jamais rien elle-même : l'organisateur revoit encore les champs avant de
// cliquer "Créer le tournoi". Cible les champs du formulaire par id (voir
// organiser/nouveau/page.tsx) plutôt que de transformer toute la page en
// composant client contrôlé.
export function AssistantOrganisateur() {
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [applique, setApplique] = useState(false);
  const [proposition, setProposition] = useState<SuggestionTournoi | null>(null);
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
    setProposition(null);
    demarrer(async () => {
      const resultat = await suggererConfigurationTournoi(description);
      if ("erreur" in resultat) {
        setErreur(resultat.erreur);
        return;
      }
      setProposition(resultat.suggestion);
    });
  }

  function accepter() {
    if (!proposition) return;
    appliquerSuggestion(proposition);
    setProposition(null);
    setApplique(true);
  }

  return (
    <div className="mb-6 rounded-[3px] border border-line bg-surface p-4">
      <span className="font-texte text-mini font-medium text-muted uppercase">
        Assistant organisateur (IA)
      </span>
      <p className="mt-1 text-sm text-muted">
        Décris ton tournoi, l&apos;assistant te propose une configuration — tu l&apos;appliques
        au formulaire ci-dessous ou tu l&apos;ignores.
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Ex. « Samedi soir, une trentaine de joueurs, EUW »"
        className="mt-3 w-full resize-none rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      {erreur && <p className="mt-2 text-sm text-accent">{erreur}</p>}
      {proposition && (
        <div className="mt-3 rounded-[3px] border border-line border-l-[3px] border-l-accent bg-bg p-3">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Proposition de l&apos;assistant
          </span>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Nom</dt>
            <dd className="text-text">{proposition.nom}</dd>
            <dt className="text-muted">Capacité</dt>
            <dd className="font-texte tabular-nums text-text">{proposition.capacite} joueurs</dd>
            <dt className="text-muted">Région</dt>
            <dd className="font-texte tabular-nums text-text">{proposition.region}</dd>
            <dt className="text-muted">Début</dt>
            <dd className="font-texte tabular-nums text-text">{proposition.debute_le.replace("T", " ")}</dd>
            <dt className="text-muted">Check-in</dt>
            <dd className="font-texte tabular-nums text-text">{proposition.checkin_ouvre_le.replace("T", " ")}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={accepter}
              className="rounded-[3px] bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:brightness-110"
            >
              Appliquer au formulaire
            </button>
            <button
              type="button"
              onClick={() => setProposition(null)}
              className="rounded-[3px] border border-line bg-bg px-4 py-2 text-sm font-semibold text-text transition hover:border-text"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}
      {applique && !erreur && (
        <p className="mt-2 text-sm text-accent">
          Formulaire prérempli — vérifie les champs avant de créer le tournoi.
        </p>
      )}
      <button
        type="button"
        onClick={lancer}
        disabled={enCours || description.trim().length < 3}
        className="mt-3 rounded-[3px] border border-line bg-bg px-4 py-2 text-sm font-semibold text-text transition hover:border-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enCours ? "Réflexion en cours…" : "Proposer une configuration"}
      </button>
      <p className="mt-2 text-[0.78rem] text-muted">
        Il ne crée ni ne modifie jamais rien lui-même, et n&apos;a aucun accès à ton classement — il
        propose, tu valides chaque champ avant de créer le tournoi.
      </p>
    </div>
  );
}
