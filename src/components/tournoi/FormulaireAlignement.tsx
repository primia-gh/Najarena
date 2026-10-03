import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import { TAILLE_ALIGNEMENT } from "@/lib/cinq-contre-cinq";

// Choix des cinq joueurs d'une équipe pour un tournoi 5v5 (03/10/2026, audit
// N21) : inscription de l'équipe ou changement d'alignement. Formulaire
// simple, sans script : la base vérifie tout (cinq membres acceptés,
// capitaine compris, comptes Riot vérifiés dans la région du tournoi) et
// l'action renvoie un message clair en cas de refus.

export interface MembreAlignable {
  profileId: string;
  pseudo: string;
  /** Compte Riot vérifié dans la région du tournoi. */
  compteValide: boolean;
}

interface FormulaireAlignementProps {
  action: (formData: FormData) => Promise<void>;
  tournamentId: string;
  slug: string;
  region: string;
  /** Absent pour un changement d'alignement (l'équipe est déjà inscrite). */
  teamId?: string;
  capitaineId: string;
  /** Membres acceptés, capitaine en tête. */
  membres: MembreAlignable[];
  /** Joueurs cochés au départ (alignement actuel, ou les cinq premiers). */
  coches: string[];
  libelle: string;
}

export default function FormulaireAlignement({
  action,
  tournamentId,
  slug,
  region,
  teamId,
  capitaineId,
  membres,
  coches,
  libelle,
}: FormulaireAlignementProps) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <input type="hidden" name="slug" value={slug} />
      {teamId && <input type="hidden" name="team_id" value={teamId} />}
      {/* Le capitaine est toujours aligné : case cochée, non modifiable. */}
      <input type="hidden" name="joueurs" value={capitaineId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-mini text-muted uppercase">{TAILLE_ALIGNEMENT} joueurs, toi compris</legend>
        {membres.map((m) => {
          const estCapitaine = m.profileId === capitaineId;
          return (
            <label key={m.profileId} className="flex min-h-11 items-center gap-2.5 text-sm text-text">
              <input
                type="checkbox"
                name={estCapitaine ? undefined : "joueurs"}
                value={m.profileId}
                defaultChecked={estCapitaine || coches.includes(m.profileId)}
                disabled={estCapitaine}
                className="h-4 w-4 accent-accent"
              />
              <span className="min-w-0 truncate">
                {m.pseudo}
                {estCapitaine && <span className="text-muted"> · capitaine</span>}
              </span>
              {!m.compteValide && <span className="text-xs text-danger">compte Riot {region} à vérifier</span>}
            </label>
          );
        })}
      </fieldset>
      <BoutonEnvoi libelleEnCours="Envoi…" className="w-full">
        {libelle}
      </BoutonEnvoi>
    </form>
  );
}
