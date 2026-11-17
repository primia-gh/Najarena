import { enregistrerResultat } from "@/lib/organisation-actions";
import { classeChamp } from "@/lib/design";
import type { NiveauVerdict } from "@/lib/tournois";
import { BadgeVerdict } from "@/components/design/Badges";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import Icone from "@/components/design/Icone";

// Match du cockpit de l'organisateur (revue visuelle du 05/10/2026). Avant :
// chaque match sans verdict affichait en grand le formulaire « Déclarer le
// vainqueur », y compris un match pas encore joué, et un litige s'écrivait
// en vert comme un résultat vérifié. Désormais : état du match en clair
// (à jouer, en cours, litige à trancher, verdict avec son niveau), et la
// décision manuelle repliée derrière « Trancher à la main » — ouverte
// d'office seulement pour un litige. Un verdict manuel ne compte jamais au
// classement (CLAUDE.md §3) : il ne doit pas être l'action la plus visible.

export interface ParticipantCockpit {
  profileId: string;
  nom: string;
  gagnant: boolean | null;
}

interface CarteMatchCockpitProps {
  matchId: string;
  tournoiId: string;
  statut: string;
  participants: ParticipantCockpit[];
  verdict: { niveau: NiveauVerdict; motif: string | null } | null;
}

function Etat({ statut, verdict, nbParticipants }: { statut: string; verdict: CarteMatchCockpitProps["verdict"]; nbParticipants: number }) {
  if (verdict) return <BadgeVerdict niveau={verdict.niveau} />;
  if (statut === "litige")
    return (
      <span className="inline-flex items-center gap-1.5 font-texte text-mini font-semibold text-danger uppercase">
        <Icone nom="alerte" taille={13} />
        Litige — à trancher
      </span>
    );
  if (statut === "en_cours") return <span className="font-texte text-mini font-semibold text-text uppercase">En cours</span>;
  if (nbParticipants < 2)
    return <span className="font-texte text-mini font-medium text-faint uppercase">En attente d&apos;adversaire</span>;
  return <span className="font-texte text-mini font-medium text-muted uppercase">À jouer</span>;
}

export default function CarteMatchCockpit({ matchId, tournoiId, statut, participants, verdict }: CarteMatchCockpitProps) {
  const litige = !verdict && statut === "litige";
  const peutDecider = !verdict && participants.length === 2;
  const affiche = participants.map((p) => p.nom).join(" contre ");

  return (
    <article
      className={`panneau relative flex flex-col gap-4 overflow-hidden p-5 ${litige ? "border-l-2 border-l-danger" : ""}`}
      aria-label={participants.length > 0 ? affiche : "Match à venir"}
    >
      {participants.length === 0 ? (
        <p className="text-sm text-faint">Match à venir</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {participants.map((p) => (
            <li key={p.profileId} className="flex items-center justify-between gap-3">
              <span className={`truncate ${p.gagnant === false ? "text-muted" : "font-semibold text-text"}`}>{p.nom}</span>
              {p.gagnant === true && (
                <span className="font-texte text-mini font-bold text-accent" aria-label="vainqueur">
                  V
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        <Etat statut={statut} verdict={verdict} nbParticipants={participants.length} />
        {verdict?.motif && <p className="text-xs text-muted">Motif : {verdict.motif}</p>}
        {litige && (
          <p className="text-xs text-text-2">
            Le résultat n&apos;a pas été retrouvé automatiquement chez Riot. Ta décision sera affichée « Manuel », avec son
            motif, et ne comptera pas au classement.
          </p>
        )}
      </div>

      {peutDecider && (
        <details open={litige} className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-muted hover:text-text [&::-webkit-details-marker]:hidden">
            <Icone nom="crayon" taille={14} />
            Trancher à la main
            <span aria-hidden="true" className="transition-transform duration-200 group-open:rotate-90">
              ›
            </span>
          </summary>
          <form action={enregistrerResultat} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="match_id" value={matchId} />
            <input type="hidden" name="tournament_id" value={tournoiId} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-texte text-mini font-medium text-muted uppercase">Vainqueur — {affiche}</legend>
              {participants.map((p) => (
                <label key={p.profileId} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text">
                  <input type="radio" name="gagnant_id" value={p.profileId} required className="h-4 w-4 accent-accent" />
                  {p.nom}
                </label>
              ))}
            </fieldset>
            <input
              name="motif"
              type="text"
              required
              aria-label={`Motif — ${affiche}`}
              placeholder="Motif (obligatoire, affiché publiquement)"
              className={classeChamp()}
            />
            <BoutonEnvoi
              variante={litige ? "principal" : "contour"}
              aria-label={`Enregistrer le résultat — ${affiche}`}
              libelleEnCours="Enregistrement…"
              className="self-start"
            >
              Enregistrer le résultat
            </BoutonEnvoi>
          </form>
        </details>
      )}
    </article>
  );
}
