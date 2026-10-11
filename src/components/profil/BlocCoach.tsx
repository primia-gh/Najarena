import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formaterDate } from "@/lib/tournois";
import { COACH_MESURES_MIN, COACH_TOURNOIS_MIN, formaterPoints, progressionMesurable, resumeCoach } from "@/lib/coach";
import { demanderCoaching, reglerEleves, repondreCoaching, terminerCoaching } from "@/lib/coach-actions";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import Alerte from "@/components/design/Alerte";
import { Choix } from "@/components/design/Formulaire";

// Coach vérifié (09/10/2026, idée en réserve n°8) : un joueur classé
// Diamant ou plus et la progression de ses élèves, lue dans le registre
// des points pendant leur suivi. Absent du CV d'un joueur qui n'est pas
// (ou plus) Diamant, sauf pour l'élève dont le suivi est en cours.

interface Props {
  profilId: string;
  slug: string;
  pseudo: string;
  visiteurId: string | null;
  estProprietaire: boolean;
  message?: string;
  erreur?: string;
}

const dateCourte = (iso: string) => formaterDate(iso).split(" ")[0];

export default async function BlocCoach({ profilId, slug, pseudo, visiteurId, estProprietaire, message, erreur }: Props) {
  const supabase = await createClient();
  const [{ data: eligible }, { data: caseCochee }, { data: elevesData }, { data: monSuivi }] = await Promise.all([
    supabase.rpc("est_coach_eligible", { p_profile_id: profilId }),
    supabase.rpc("accepte_eleves", { p_profile_id: profilId }),
    supabase.rpc("eleves_coach", { p_coach: profilId }),
    visiteurId && !estProprietaire
      ? supabase
          .from("coachings")
          .select("id, coach_id, statut")
          .eq("eleve_id", visiteurId)
          .in("statut", ["demande", "actif"])
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const eleves = elevesData ?? [];
  const suiviIci = monSuivi && monSuivi.coach_id === profilId ? monSuivi : null;
  // « Coach vérifié » seulement si le joueur l'a choisi (case « J'accepte
  // des élèves », décochée par défaut — décision du 11/10/2026). Sinon le
  // bloc n'apparaît qu'à lui-même (pour cocher) et à son élève en cours.
  const ouvert = Boolean(eligible && caseCochee);
  if (!ouvert && !suiviIci && !(estProprietaire && (eligible || eleves.length > 0))) return null;

  const demandes = eleves.filter((e) => e.statut === "demande");
  const suivis = eleves.filter((e) => e.statut !== "demande");
  const resume = resumeCoach(suivis);

  return (
    <Panneau as="section" id="coach" className="flex scroll-mt-28 flex-col gap-6 p-6 sm:p-8" aria-labelledby="titre-coach">
      <div className="flex flex-col gap-2">
        <LibelleSection as="h2" id="titre-coach">
          {ouvert ? "Coach vérifié" : estProprietaire && eligible ? "Coach" : "Suivi"}
        </LibelleSection>
        <p className="text-sm text-muted">
          {ouvert
            ? `${pseudo} est classé Diamant Najarena (rating officiel de 1750 ou plus) et accepte des élèves. Leurs points sont lus dans le registre : variations en tournoi pendant le suivi, rien de déclaré. C'est ce qui s'est passé pendant le suivi, pas une mesure de l'effet du coach.`
            : !eligible
              ? `${pseudo} n'est plus classé Diamant Najarena (rating officiel de 1750 ou plus) : pas de nouvel élève possible.`
              : estProprietaire
                ? "Tu es classé Diamant Najarena (rating officiel de 1750 ou plus) : tu peux suivre des élèves. « Coach vérifié » n'apparaît sur ton CV, et tu ne reçois de demandes, que si tu coches la case ci-dessous."
                : `${pseudo} n'accepte plus de nouvel élève ; ton suivi continue.`}
        </p>
      </div>

      {/* La case du coach, sur son propre CV. */}
      {estProprietaire && eligible && (
        <form action={reglerEleves} className="flex max-w-xl flex-col gap-3">
          <input type="hidden" name="slug" value={slug} />
          <Choix
            type="checkbox"
            name="accepte"
            value="1"
            defaultChecked={ouvert}
            titre="J'accepte des élèves"
            detail="Ton CV affiche « Coach vérifié » et les joueurs peuvent te demander un suivi. Décoche-la pour ne plus en recevoir : tes suivis en cours continuent."
          />
          <BoutonEnvoi variante="contour" libelleEnCours="Enregistrement…" className="self-start">
            Enregistrer
          </BoutonEnvoi>
        </form>
      )}

      {message && <Alerte type="succes">{message}</Alerte>}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {suivis.length > 0 && (
        <p className="text-sm text-text-2">
          <span className="tabular-nums">{resume.suivis}</span> élève{resume.suivis > 1 ? "s" : ""} suivi
          {resume.suivis > 1 ? "s" : ""}
          {resume.medianePoints !== null ? (
            <>
              {" "}
              · <span className="tabular-nums">{resume.enProgression}</span> en progression sur{" "}
              <span className="tabular-nums">{resume.mesures}</span> mesuré{resume.mesures > 1 ? "s" : ""} · médiane{" "}
              <span className="font-semibold text-text tabular-nums">{formaterPoints(resume.medianePoints)}</span> points
            </>
          ) : (
            ` · résumé à partir de ${COACH_MESURES_MIN} élèves ayant joué ${COACH_TOURNOIS_MIN} tournois pendant leur suivi`
          )}
          .
        </p>
      )}

      {suivis.length > 0 && (
        <Tableau legende={`Élèves suivis par ${pseudo}`}>
          <thead>
            <tr>
              <th scope="col">Élève</th>
              <th scope="col" className="text-right">
                Tournois
              </th>
              <th scope="col" className="text-right">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {suivis.map((e) => (
              <tr key={e.coaching_id}>
                {/* Date et fin du suivi sous le nom : la colonne « Points »
                    reste visible sur téléphone. */}
                <td>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/joueur/${e.eleve_slug}`}
                      className="inline-flex min-h-11 items-center self-start font-semibold hover:text-accent"
                    >
                      {e.eleve_pseudo}
                    </Link>
                    <span className="text-xs text-muted tabular-nums">
                      {e.debut_le ? dateCourte(e.debut_le) : ""} → {e.fin_le ? dateCourte(e.fin_le) : "en cours"}
                    </span>
                    {estProprietaire && e.statut === "actif" && (
                      // Deux temps (ouvrir, puis confirmer) : un suivi ne se
                      // ferme pas d'un tapotement involontaire.
                      <details className="text-xs">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted underline underline-offset-3 hover:text-text">
                          Terminer le suivi
                        </summary>
                        <form action={terminerCoaching} className="mt-2 flex flex-col items-start gap-2">
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="coaching" value={e.coaching_id} />
                          {/* Étroit : la colonne « Points » reste visible sur téléphone. */}
                          <span className="max-w-[18ch] text-text-2">Terminer ce suivi ? Sa progression reste affichée.</span>
                          <BoutonEnvoi
                            variante="contour"
                            libelleEnCours="…"
                            aria-label={`Confirmer la fin du suivi de ${e.eleve_pseudo}`}
                          >
                            Oui
                          </BoutonEnvoi>
                        </form>
                      </details>
                    )}
                  </div>
                </td>
                <td className="text-right tabular-nums">{e.tournois}</td>
                <td className="text-right tabular-nums">
                  {progressionMesurable(e) ? (
                    <span className={e.points > 0 ? "font-semibold text-text" : "text-text-2"}>
                      {formaterPoints(e.points)}
                    </span>
                  ) : (
                    <span className="text-muted" title={`Mesurée à partir de ${COACH_TOURNOIS_MIN} tournois`}>
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {/* Le coach : demandes en attente. */}
      {estProprietaire && demandes.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <h3 className="text-mini text-muted uppercase">Demandes de suivi · {demandes.length}</h3>
          {demandes.map((d) => (
            <div key={d.coaching_id} className="flex flex-wrap items-center gap-3">
              <Link href={`/joueur/${d.eleve_slug}`} className="text-sm font-semibold hover:text-accent">
                {d.eleve_pseudo}
              </Link>
              <form action={repondreCoaching}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="coaching" value={d.coaching_id} />
                <input type="hidden" name="accepter" value="1" />
                <BoutonEnvoi libelleEnCours="…">
                  Accepter
                </BoutonEnvoi>
              </form>
              <form action={repondreCoaching}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="coaching" value={d.coaching_id} />
                <input type="hidden" name="accepter" value="0" />
                <BoutonEnvoi variante="contour" libelleEnCours="…">
                  Refuser
                </BoutonEnvoi>
              </form>
            </div>
          ))}
        </div>
      )}

      {estProprietaire && ouvert && suivis.length === 0 && demandes.length === 0 && (
        <p className="text-sm text-muted">
          Aucun élève pour l&apos;instant : un joueur peut te demander un suivi depuis ton CV.
        </p>
      )}

      {/* Un visiteur connecté : demander, annuler ou terminer son suivi. */}
      {visiteurId && !estProprietaire && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          {suiviIci ? (
            <form action={terminerCoaching} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="coaching" value={suiviIci.id} />
              <input type="hidden" name="demande" value={suiviIci.statut === "demande" ? "1" : "0"} />
              <span className="text-sm text-text-2">
                {suiviIci.statut === "demande"
                  ? `Demande envoyée à ${pseudo}.`
                  : `${pseudo} te suit : ta progression en tournoi s'affiche ici.`}
              </span>
              <BoutonEnvoi variante="contour" libelleEnCours="…">
                {suiviIci.statut === "demande" ? "Annuler la demande" : "Terminer le suivi"}
              </BoutonEnvoi>
            </form>
          ) : monSuivi ? (
            <p className="text-sm text-muted">Tu as déjà un suivi en cours avec un autre coach.</p>
          ) : ouvert ? (
            <form action={demanderCoaching} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="coach" value={profilId} />
              <span className="text-sm text-text-2">
                Ta progression en tournoi sera affichée ici pendant le suivi.
              </span>
              <BoutonEnvoi variante="contour" libelleEnCours="Envoi…">
                Demander un suivi
              </BoutonEnvoi>
            </form>
          ) : null}
        </div>
      )}
    </Panneau>
  );
}
