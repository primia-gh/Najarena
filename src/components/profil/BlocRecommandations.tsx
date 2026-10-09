import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formaterDate } from "@/lib/tournois";
import { classeChamp } from "@/lib/design";
import {
  libelleMatchsCommuns,
  RECOMMANDATION_MAX,
  RECOMMANDATION_MIN,
} from "@/lib/recommandations";
import { masquerRecommandation, recommanderJoueur, retirerRecommandation } from "@/lib/recommandation-actions";
import Panneau from "@/components/design/Panneau";
import LibelleSection from "@/components/design/LibelleSection";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import Alerte from "@/components/design/Alerte";

// Recommandations vérifiées (09/10/2026, idée en réserve n°7) : écrites
// seulement par des joueurs qui ont réellement joué avec ou contre ce
// joueur une partie lue chez Riot ; le nombre de matchs communs est
// recalculé par la base à chaque affichage. Absent du CV tant qu'il n'y a
// rien à montrer ni à écrire (jamais de bloc vide).

interface Props {
  profilId: string;
  slug: string;
  pseudo: string;
  visiteurId: string | null;
  estProprietaire: boolean;
  message?: string;
  erreur?: string;
}

export default async function BlocRecommandations({ profilId, slug, pseudo, visiteurId, estProprietaire, message, erreur }: Props) {
  const supabase = await createClient();
  const [{ data: recommandations }, communs, { data: maRecommandation }] = await Promise.all([
    supabase.rpc("recommandations_joueur", { p_profile_id: profilId }),
    visiteurId && !estProprietaire
      ? supabase.rpc("matchs_communs", { p_a: visiteurId, p_b: profilId }).then((r) => r.data?.[0] ?? null)
      : Promise.resolve(null),
    visiteurId && !estProprietaire
      ? supabase
          .from("recommandations")
          .select("texte, masquee")
          .eq("auteur_id", visiteurId)
          .eq("destinataire_id", profilId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const liste = recommandations ?? [];
  const peutEcrire = Boolean(communs && communs.ensemble + communs.contre > 0);

  if (liste.length === 0 && !peutEcrire && !estProprietaire && !maRecommandation && !message && !erreur) return null;

  return (
    <Panneau as="section" id="recommandations" className="flex scroll-mt-28 flex-col gap-6 p-6 sm:p-8" aria-labelledby="titre-recommandations">
      <div className="flex flex-col gap-2">
        <LibelleSection as="h2" id="titre-recommandations">
          Recommandations
        </LibelleSection>
        <p className="text-sm text-muted">
          Écrites seulement par des joueurs qui ont réellement joué avec ou contre {pseudo} une partie lue chez Riot.
          Le nombre de matchs communs est recompté par Najarena, jamais déclaré.
        </p>
      </div>

      {message && <Alerte type="succes">{message}</Alerte>}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {liste.length === 0 ? (
        <p className="text-sm text-muted">
          {estProprietaire
            ? "Aucune recommandation pour l'instant : les joueurs que tu as affrontés ou avec qui tu as joué peuvent t'en laisser une depuis ton CV."
            : `Aucune recommandation pour ${pseudo} pour l'instant.`}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {liste.map((r) => (
            <li key={r.auteur_id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
              <blockquote className={`text-sm leading-relaxed ${r.masquee ? "text-muted" : "text-text"}`}>
                « {r.texte} »
              </blockquote>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <Link href={`/joueur/${r.auteur_slug}`} className="font-semibold text-text hover:text-accent">
                  {r.auteur_pseudo}
                </Link>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{libelleMatchsCommuns(r.matchs_ensemble, r.matchs_contre)}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{formaterDate(r.modifie_le)}</span>
                {r.masquee && <span className="tracking-[2px] uppercase">· Masquée de ton CV</span>}
              </p>
              {estProprietaire && (
                <form action={masquerRecommandation}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="auteur" value={r.auteur_id} />
                  <input type="hidden" name="masquee" value={r.masquee ? "0" : "1"} />
                  <BoutonEnvoi variante="contour" className="self-start">
                    {r.masquee ? "Afficher sur mon CV" : "Masquer de mon CV"}
                  </BoutonEnvoi>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {peutEcrire && communs && (
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <h3 className="font-titre text-2xl leading-none font-extrabold uppercase">
            {maRecommandation ? "Ta recommandation" : `Recommander ${pseudo}`}
          </h3>
          <p className="text-xs text-muted">
            Vous avez joué {libelleMatchsCommuns(communs.ensemble, communs.contre)}. Ce que tu écris est public, avec ton
            pseudo{maRecommandation?.masquee ? ` ; ${pseudo} l'a masquée de son CV` : ""}.
          </p>
          <form action={recommanderJoueur} className="flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="destinataire" value={profilId} />
            <label htmlFor="texte-recommandation" className="sr-only">
              Ta recommandation
            </label>
            <textarea
              id="texte-recommandation"
              name="texte"
              required
              minLength={RECOMMANDATION_MIN}
              maxLength={RECOMMANDATION_MAX}
              rows={4}
              defaultValue={maRecommandation?.texte ?? ""}
              placeholder="Ce que tu as constaté en jouant avec ou contre lui : régularité, communication, ponctualité…"
              className={classeChamp()}
            />
            <div className="flex flex-wrap gap-3">
              <BoutonEnvoi libelleEnCours="Envoi…">{maRecommandation ? "Modifier" : "Publier"}</BoutonEnvoi>
              {maRecommandation && (
                <BoutonEnvoi variante="contour" formAction={retirerRecommandation} libelleEnCours="Retrait…">
                  Retirer
                </BoutonEnvoi>
              )}
            </div>
          </form>
        </div>
      )}
    </Panneau>
  );
}
