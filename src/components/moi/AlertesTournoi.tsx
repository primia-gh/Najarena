import Link from "next/link";
import Alerte from "@/components/design/Alerte";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import { Pastille } from "@/components/design/Formulaire";
import LibelleSection from "@/components/design/LibelleSection";
import { couperAlertesTournoi, reglerAlertesTournoi } from "@/lib/alertes-actions";
import {
  ALERTES_PAR_JOUR,
  FORMATS_ALERTE,
  LABEL_FORMAT_ALERTE,
  PREAVIS_MAX_JOURS,
  PREAVIS_MIN_HEURES,
  resumeAlertes,
} from "@/lib/alertes-tournoi";
import { HEURES_MOMENT } from "@/lib/duo";
import { typographie } from "@/lib/typographie";

// Alertes « tournoi pour toi » (20/11/2026), bloc de /moi : créneaux et
// formats, enregistrés par la base (regler_alertes_tournoi). Les heures de
// chaque moment viennent du duo (HEURES_MOMENT) : une seule source.

const MOMENTS = [
  { cle: "journee", libelle: "Journée" },
  { cle: "soir", libelle: "Soir" },
  { cle: "nuit", libelle: "Nuit" },
] as const;

const JOURS = [
  { cle: "semaine", libelle: "En semaine" },
  { cle: "weekend", libelle: "Le week-end" },
] as const;

export default function AlertesTournoi({
  reglage,
  compteVerifie,
  region,
  canaux,
  retour,
}: {
  reglage: { creneaux: string[]; formats: string[] } | null;
  compteVerifie: boolean;
  region: string | null;
  /** Canaux par lesquels une alerte peut arriver. */
  canaux: { push: boolean; discord: boolean };
  /** Retour de la dernière action du bloc, affiché ici plutôt qu'en haut de page. */
  retour: { message?: string; erreur?: string } | null;
}) {
  const resume = reglage ? resumeAlertes(reglage.creneaux, reglage.formats) : null;
  const aucunCanal = !canaux.push && !canaux.discord;
  return (
    <section aria-labelledby="moi-alertes" className="flex scroll-mt-28 flex-col gap-4">
      <LibelleSection as="h2" id="moi-alertes" className="border-b border-line-strong pb-4">
        Tournois pour toi
      </LibelleSection>
      {retour?.erreur && <Alerte type="erreur">{retour.erreur}</Alerte>}
      {retour?.message && <Alerte type="succes">{retour.message}</Alerte>}
      {!compteVerifie ? (
        <p className="text-sm text-text-2">
          {typographie("Lie et vérifie ton Riot ID : un message te signalera les tournois qui s'ouvrent sur ton serveur.")}{" "}
          <Link href="/lier-riot" className="text-text underline underline-offset-3 hover:decoration-text hover:decoration-2">
            Lier mon Riot ID
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm text-text-2">
            {typographie(
              `Un message, en notification du navigateur ou en message privé Discord (jamais par e-mail), quand un tournoi s'ouvre sur ${region ?? "ton serveur"} au créneau et au format choisis, ouvert à toi (niveau, réservations) et avec encore de la place. ${ALERTES_PAR_JOUR} par jour au plus, de ${PREAVIS_MIN_HEURES} h à ${PREAVIS_MAX_JOURS} jours avant le début, jamais deux fois le même tournoi.`,
            )}
          </p>
          {aucunCanal ? (
            <p className="rounded-carte border border-line-strong p-3 text-sm text-text">
              {typographie(
                "Aucun canal actif pour l'instant : sans notifications du navigateur (rubrique « Notifications ») ni compte créé avec Discord, aucune alerte ne peut t'arriver.",
              )}
            </p>
          ) : (
            <p className="text-xs text-muted">
              {typographie(
                `Elles t'arriveront ${
                  canaux.push && canaux.discord
                    ? "en notification du navigateur et en message privé Discord"
                    : canaux.push
                      ? "en notification du navigateur"
                      : "en message privé Discord"
                }.`,
              )}
            </p>
          )}
          {resume ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-texte text-mini font-semibold tracking-[2px] text-text uppercase">Activées</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted">Créneaux</dt>
                <dd className="text-text-2">{resume.creneaux}</dd>
                <dt className="text-muted">Formats</dt>
                <dd className="text-text-2">{resume.formats}</dd>
              </dl>
            </div>
          ) : (
            <p className="font-texte text-mini font-semibold tracking-[2px] text-muted uppercase">Coupées</p>
          )}
          <form action={reglerAlertesTournoi} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3" aria-describedby="aide-alertes-creneaux">
              <legend className="mb-1 font-texte text-mini font-medium text-muted uppercase">Créneaux</legend>
              {JOURS.map((jours) => (
                <fieldset key={jours.cle} className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm text-text-2">{jours.libelle}</legend>
                  <div className="flex flex-wrap gap-2">
                    {MOMENTS.map((m) => {
                      const valeur = `${jours.cle}_${m.cle}`;
                      return (
                        <Pastille
                          key={valeur}
                          name="creneaux"
                          value={valeur}
                          defaultChecked={Boolean(reglage?.creneaux.includes(valeur))}
                        >
                          {m.libelle}
                        </Pastille>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              <span id="aide-alertes-creneaux" className="text-xs text-muted">
                {typographie(
                  `Heure de Paris : journée ${HEURES_MOMENT.journee}, soir ${HEURES_MOMENT.soir}, nuit ${HEURES_MOMENT.nuit}. Le week-end, c'est samedi et dimanche.`,
                )}
              </span>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-texte text-mini font-medium text-muted uppercase">Formats</legend>
              <div className="flex flex-wrap gap-2">
                {FORMATS_ALERTE.map((f) => (
                  <Pastille
                    key={f}
                    name="formats"
                    value={f}
                    defaultChecked={reglage ? reglage.formats.includes(f) : f === "1v1"}
                  >
                    {LABEL_FORMAT_ALERTE[f]}
                  </Pastille>
                ))}
              </div>
            </fieldset>
            <div>
              <BoutonEnvoi variante="contour" libelleEnCours="Enregistrement…">
                {reglage ? "Mettre à jour mes alertes" : "Activer mes alertes"}
              </BoutonEnvoi>
            </div>
          </form>
          {reglage && (
            <form action={couperAlertesTournoi}>
              <button
                type="submit"
                className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-danger"
              >
                Couper les alertes
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
