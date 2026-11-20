import Link from "next/link";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import { Pastille } from "@/components/design/Formulaire";
import LibelleSection from "@/components/design/LibelleSection";
import { couperAlertesTournoi, reglerAlertesTournoi } from "@/lib/alertes-actions";
import {
  ALERTES_PAR_JOUR,
  FORMATS_ALERTE,
  LABEL_FORMAT_ALERTE,
  PREAVIS_MAX_JOURS,
  resumeAlertes,
} from "@/lib/alertes-tournoi";
import { typographie } from "@/lib/typographie";

// Alertes « tournoi pour toi » (20/11/2026), bloc de /moi : créneaux et
// formats, enregistrés par la base (regler_alertes_tournoi).

const MOMENTS = [
  { cle: "journee", libelle: "Journée", heures: "avant 18 h" },
  { cle: "soir", libelle: "Soir", heures: "18 h – 23 h" },
  { cle: "nuit", libelle: "Nuit", heures: "après 23 h" },
] as const;

export default function AlertesTournoi({
  reglage,
  compteVerifie,
  region,
}: {
  reglage: { creneaux: string[]; formats: string[] } | null;
  compteVerifie: boolean;
  region: string | null;
}) {
  return (
    <section aria-labelledby="moi-alertes" className="flex scroll-mt-28 flex-col gap-4">
      <LibelleSection as="h2" id="moi-alertes" className="border-b border-line-strong pb-4">
        Tournois pour toi
      </LibelleSection>
      {!compteVerifie ? (
        <p className="text-sm text-text-2">
          {typographie("Lie et vérifie ton Riot ID : un message te signalera les tournois qui s'ouvrent sur ton serveur.")}{" "}
          <Link href="/lier-riot" className="text-text underline underline-offset-3 hover:text-accent">
            Lier mon Riot ID
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm text-text-2">
            {typographie(
              `Un message quand un tournoi s'ouvre sur ${region ?? "ton serveur"}, au créneau et au format choisis, ouvert à toi (niveau, réservations) et avec encore de la place. ${ALERTES_PAR_JOUR} par jour au plus, de 1 h à ${PREAVIS_MAX_JOURS} jours avant le début, jamais deux fois le même tournoi.`,
            )}
          </p>
          <p className="text-sm">
            {reglage ? (
              <>
                <span className="font-texte text-mini font-semibold tracking-[2px] text-text uppercase">Activées</span>{" "}
                <span className="text-text-2">{resumeAlertes(reglage.creneaux, reglage.formats)}</span>
              </>
            ) : (
              <span className="font-texte text-mini font-semibold tracking-[2px] text-muted uppercase">Coupées</span>
            )}
          </p>
          <form action={reglerAlertesTournoi} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3" aria-describedby="aide-alertes-creneaux">
              <legend className="mb-1 font-texte text-mini font-medium text-muted uppercase">Créneaux</legend>
              {(["semaine", "weekend"] as const).map((jours) => (
                <div key={jours} className="flex flex-col gap-2">
                  <span className="text-sm text-text-2">{jours === "semaine" ? "En semaine" : "Le week-end"}</span>
                  <div className="flex flex-wrap gap-2">
                    {MOMENTS.map((m) => {
                      const valeur = `${jours}_${m.cle}`;
                      return (
                        <Pastille
                          key={valeur}
                          name="creneaux"
                          value={valeur}
                          defaultChecked={Boolean(reglage?.creneaux.includes(valeur))}
                        >
                          <span className="sr-only">{jours === "semaine" ? "En semaine, " : "Le week-end, "}</span>
                          {m.libelle}
                        </Pastille>
                      );
                    })}
                  </div>
                </div>
              ))}
              <span id="aide-alertes-creneaux" className="text-xs text-muted">
                {typographie(
                  `Heure de Paris : ${MOMENTS.map((m) => `${m.libelle.toLowerCase()} ${m.heures}`).join(", ")}. Le week-end, c'est samedi et dimanche.`,
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
          <p className="text-xs text-muted">
            {typographie(
              "Elles arrivent en notification (à activer juste au-dessus) et, si ton compte est lié à Discord, en message privé. Jamais par e-mail.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
