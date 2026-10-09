import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formaterDate } from "@/lib/tournois";
import { COACH_TOURNOIS_MIN, formaterPoints, progressionMesurable, resumeCoach } from "@/lib/coach";
import { demanderCoaching, repondreCoaching, terminerCoaching } from "@/lib/coach-actions";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import Tableau from "@/components/design/Tableau";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import Alerte from "@/components/design/Alerte";

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
  const [{ data: eligible }, { data: elevesData }, { data: monSuivi }] = await Promise.all([
    supabase.rpc("est_coach_eligible", { p_profile_id: profilId }),
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
  if (!eligible && !suiviIci && !(estProprietaire && eleves.length > 0)) return null;

  const demandes = eleves.filter((e) => e.statut === "demande");
  const suivis = eleves.filter((e) => e.statut !== "demande");
  const resume = resumeCoach(suivis);

  return (
    <Panneau as="section" id="coach" className="flex scroll-mt-28 flex-col gap-6 p-6 sm:p-8" aria-labelledby="titre-coach">
      <div className="flex flex-col gap-2">
        <LibelleSection as="h2" id="titre-coach">
          {eligible ? "Coach vérifié" : "Suivi"}
        </LibelleSection>
        <p className="text-sm text-muted">
          {eligible
            ? `${pseudo} est classé Diamant ou plus et peut suivre des élèves. Leur progression est lue dans le registre des points : variations en tournoi pendant le suivi, rien de déclaré.`
            : `${pseudo} n'est plus classé Diamant : il ne peut plus accepter d'élève.`}
        </p>
      </div>

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
            ` · progression mesurée à partir de ${COACH_TOURNOIS_MIN} tournois pendant le suivi`
          )}
          .
        </p>
      )}

      {suivis.length > 0 && (
        <Tableau legende={`Élèves suivis par ${pseudo}`}>
          <thead>
            <tr>
              <th scope="col">Élève</th>
              <th scope="col">Suivi</th>
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
                <td>
                  <Link href={`/joueur/${e.eleve_slug}`} className="hover:text-accent">
                    {e.eleve_pseudo}
                  </Link>
                </td>
                <td className="text-xs text-muted tabular-nums">
                  {e.debut_le ? dateCourte(e.debut_le) : ""} → {e.fin_le ? dateCourte(e.fin_le) : "en cours"}
                  {estProprietaire && e.statut === "actif" && (
                    <form action={terminerCoaching} className="mt-1">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="coaching" value={e.coaching_id} />
                      <button type="submit" className="text-xs text-muted underline underline-offset-3 hover:text-text">
                        Terminer
                      </button>
                    </form>
                  )}
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

      {estProprietaire && suivis.length === 0 && demandes.length === 0 && (
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
          ) : eligible ? (
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
