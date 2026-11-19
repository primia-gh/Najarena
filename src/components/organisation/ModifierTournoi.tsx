import { modifierTournoi } from "@/lib/organisation-actions";
import { classeChamp } from "@/lib/design";
import { REGIONS } from "@/lib/regions";
import { saisieParisDepuisInstant } from "@/lib/tournois-auto/creneaux";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import Icone from "@/components/design/Icone";
import { Champ } from "@/components/design/Formulaire";

// Modifier un tournoi avant la première inscription (19/11/2026, audit M7).
// Replié par défaut, comme « Trancher à la main » : le cockpit reste dense.
// Format, condition de victoire, caractère amical et communauté restent
// ceux de la création ; la base refuse toute modification dès qu'une
// inscription a eu lieu.

const CAPACITES = [4, 8, 16, 32, 64];
const CAPACITE_ETENDUE = 128;

export default function ModifierTournoi({
  tournoi,
  organisateurPremium,
  ouvert = false,
}: {
  tournoi: {
    id: string;
    nom: string;
    format: string;
    capacite: number;
    best_of: number;
    region: string;
    debute_le: string;
    checkin_ouvre_le: string;
  };
  organisateurPremium: boolean;
  /** Déplié d'office après une erreur, pour corriger sans chercher le bloc. */
  ouvert?: boolean;
}) {
  const unite = tournoi.format === "5v5" ? "équipes" : "places";
  // Une valeur obtenue avec l'offre Organisateur reste proposée, même sans elle.
  const capacites = organisateurPremium || tournoi.capacite === CAPACITE_ETENDUE ? [...CAPACITES, CAPACITE_ETENDUE] : CAPACITES;
  const bestOfs = organisateurPremium ? [1, 3, 5] : Array.from(new Set([1, tournoi.best_of]));

  return (
    <details id="modifier" open={ouvert} className="group max-w-2xl scroll-mt-28">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        <Icone nom="crayon" taille={14} />
        Modifier le tournoi
        <span className="text-faint">· tant que personne n&apos;est inscrit</span>
        <span aria-hidden="true" className="transition-transform duration-200 group-open:rotate-90">
          ›
        </span>
      </summary>
      <form action={modifierTournoi} className="mt-4 flex flex-col gap-5 border-l-2 border-line-strong pl-5">
        <p className="text-sm text-text-2">
          Possible tant que personne ne s&apos;est inscrit. Le format, la façon de gagner une partie et le caractère
          amical restent ceux de la création. Changer la date, le serveur ou la capacité d&apos;un tournoi publié compte
          comme une nouvelle publication pour la règle des 24&nbsp;h d&apos;un tournoi classé.
        </p>
        <input type="hidden" name="tournament_id" value={tournoi.id} />
        <Champ libelle="Nom du tournoi">
          <input
            id="modifier-nom"
            name="nom"
            type="text"
            required
            minLength={3}
            maxLength={60}
            defaultValue={tournoi.nom}
            className={classeChamp()}
          />
        </Champ>
        <div className="grid gap-5 sm:grid-cols-2">
          <Champ libelle="Capacité">
            <select
              id="modifier-capacite"
              name="capacite"
              required
              defaultValue={tournoi.capacite}
              className={classeChamp()}
            >
              {capacites.map((c) => (
                <option key={c} value={c}>
                  {c} {unite}
                  {c === CAPACITE_ETENDUE ? " — Organisateur" : ""}
                </option>
              ))}
            </select>
          </Champ>
          {bestOfs.length > 1 ? (
            <Champ libelle="Nombre de parties par match">
              <select
                id="modifier-best-of"
                name="best_of"
                defaultValue={tournoi.best_of}
                className={classeChamp()}
              >
                {bestOfs.map((b) => (
                  <option key={b} value={b}>
                    Best-of-{b}
                  </option>
                ))}
              </select>
            </Champ>
          ) : (
            <input type="hidden" name="best_of" value={tournoi.best_of} />
          )}
        </div>
        <Champ libelle="Région">
          <select id="modifier-region" name="region" required defaultValue={tournoi.region} className={classeChamp()}>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.nom}
              </option>
            ))}
          </select>
        </Champ>
        <div className="grid gap-5 sm:grid-cols-2">
          <Champ libelle="Ouverture du check-in">
            <input
              id="modifier-checkin"
              name="checkin_ouvre_le"
              type="datetime-local"
              required
              defaultValue={saisieParisDepuisInstant(tournoi.checkin_ouvre_le)}
              aria-describedby="modifier-aide-heures"
              className={classeChamp()}
            />
          </Champ>
          <Champ libelle="Début du tournoi">
            <input
              id="modifier-debut"
              name="debute_le"
              type="datetime-local"
              required
              defaultValue={saisieParisDepuisInstant(tournoi.debute_le)}
              aria-describedby="modifier-aide-heures"
              className={classeChamp()}
            />
          </Champ>
        </div>
        <p id="modifier-aide-heures" className="-mt-3 text-xs text-muted">
          Heures de Paris. Le check-in ouvre au plus tard au début du tournoi.
        </p>
        <div>
          <BoutonEnvoi variante="contour" libelleEnCours="Enregistrement…">
            Enregistrer les modifications
          </BoutonEnvoi>
        </div>
      </form>
    </details>
  );
}
