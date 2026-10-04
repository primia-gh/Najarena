import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import { preparerDossierLitige } from "@/lib/dossier-litige-actions";

// Dossier de litige préparé (03/10/2026, audit N28) : bouton pour le
// préparer, puis les faits et la synthèse. Rappel permanent : il ne
// tranche pas, la décision reste humaine (CLAUDE.md §3).

export interface DossierAffiche {
  faits: string[];
  synthese: { chronologie?: string[]; donnees_riot?: string[]; points_a_verifier?: string[] };
}

/** Lit la synthèse stockée en JSON, sans lui faire confiance aveuglément. */
export function lireSynthese(valeur: unknown): DossierAffiche["synthese"] {
  if (typeof valeur !== "object" || valeur === null) return {};
  const v = valeur as Record<string, unknown>;
  const liste = (x: unknown) => (Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : undefined);
  return {
    chronologie: liste(v.chronologie),
    donnees_riot: liste(v.donnees_riot),
    points_a_verifier: liste(v.points_a_verifier),
  };
}

function Bloc({ titre, lignes }: { titre: string; lignes?: string[] }) {
  if (!lignes || lignes.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-mini font-semibold text-muted uppercase">{titre}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-2">
        {lignes.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export default function DossierLitige({
  disputeId,
  dossier,
  depuis,
}: {
  disputeId: string;
  dossier: DossierAffiche | null;
  depuis: "admin" | "cockpit";
}) {
  if (!dossier) {
    return (
      <form action={preparerDossierLitige} className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
        <input type="hidden" name="dispute_id" value={disputeId} />
        <input type="hidden" name="depuis" value={depuis} />
        <BoutonEnvoi variante="contour" libelleEnCours="Préparation…" className="self-start">
          Préparer le dossier
        </BoutonEnvoi>
        <p className="text-xs text-muted">
          Faits du match et historique Riot des deux joueurs, rassemblés automatiquement, avec une synthèse rédigée par
          IA. Le dossier ne tranche pas : la décision t&apos;appartient.
        </p>
      </form>
    );
  }

  const { synthese } = dossier;
  return (
    <details className="mt-3 border-t border-line pt-3">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-mini font-semibold text-accent uppercase">
        Dossier préparé
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        <p className="text-xs text-muted">
          Préparé automatiquement, il ne tranche pas : il rassemble ce que disent la base et l&apos;historique Riot. La
          synthèse est rédigée par IA à partir des seuls faits listés plus bas.
        </p>
        <Bloc titre="Chronologie" lignes={synthese.chronologie} />
        <Bloc titre="Ce que montre l'historique Riot" lignes={synthese.donnees_riot} />
        <Bloc titre="Points à vérifier" lignes={synthese.points_a_verifier} />
        <Bloc titre="Faits rassemblés" lignes={dossier.faits} />
      </div>
    </details>
  );
}
