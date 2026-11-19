import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { inviterMembre } from "@/lib/equipe-actions";
import {
  annulerCandidature,
  postulerEquipe,
  publierRecrutement,
  repondreCandidature,
  retirerRecrutement,
} from "@/lib/recrutement-actions";
import {
  CHOIX_NIVEAU_RECRUTEMENT,
  candidatureExpiree,
  libelleNiveauRecrutement,
  libellePostes,
  MESSAGE_RECRUTEMENT_MAX,
} from "@/lib/recrutement";
import { palierDuRating, RATING_DEPART } from "@/lib/niveau-tournoi";
import { arrondir } from "@/lib/classement";
import { classeChamp } from "@/lib/design";
import { formaterDate } from "@/lib/tournois";
import { LABEL_ROLE, ROLES } from "@/lib/roles";
import { estRole } from "@/lib/duo";
import { typographie } from "@/lib/typographie";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";
import { Champ, Pastille } from "@/components/design/Formulaire";

// Équipes qui recrutent (19/11/2026) : sur la page d'équipe, l'annonce du
// capitaine (postes, niveau minimum, message), les candidatures reçues, les
// joueurs qui cherchent une équipe et correspondent ; pour un visiteur, le
// formulaire de candidature, ou la raison pour laquelle il ne peut pas
// postuler. Toutes les règles sont revérifiées par la base.

const PANNEAU_FORM = "flex flex-col gap-5 p-6";

// Hors du composant : la date courante ne se lit pas pendant le rendu.
function dansLeFutur(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

function candidatureEnCours(creeLe: string): boolean {
  return !candidatureExpiree("en_attente", creeLe, Date.now());
}

export default async function RecrutementEquipe({
  equipe,
  estCapitaine,
  estMembre,
  effectif,
  visiteurId,
  regionVisiteur,
}: {
  equipe: { id: string; slug: string; nom: string };
  estCapitaine: boolean;
  estMembre: boolean;
  /** Joueurs acceptés, capitaine compris. */
  effectif: number;
  visiteurId: string | null;
  /** Région du compte Riot vérifié du visiteur, ou nul. */
  regionVisiteur: string | null;
}) {
  const supabase = await createClient();
  const { data: annonce } = await supabase
    .from("annonces_recrutement")
    .select("postes, niveau_min, region, message, expire_le")
    .eq("team_id", equipe.id)
    .maybeSingle();
  const active = annonce !== null && dansLeFutur(annonce.expire_le) && effectif < 5;
  const niveau = annonce ? libelleNiveauRecrutement(annonce.niveau_min) : null;

  if (estCapitaine) {
    const [{ data: candidatures }, { data: propositions }] = await Promise.all([
      supabase
        .from("candidatures_equipe")
        .select("id, profile_id, poste, message, cree_le, profile:profiles(pseudo, slug)")
        .eq("team_id", equipe.id)
        .eq("statut", "en_attente")
        .order("cree_le", { ascending: true }),
      active ? supabase.rpc("joueurs_pour_recrutement", { p_team: equipe.id }) : Promise.resolve({ data: [] }),
    ]);
    const enCours = (candidatures ?? []).filter((c) => candidatureEnCours(c.cree_le));
    // Niveau des candidats, même règle que les propositions : un rating
    // seulement une fois le joueur classé (RD ≤ 150), jamais avant.
    const idsCandidats = enCours.map((c) => c.profile_id);
    const { data: ratingsCandidats } =
      idsCandidats.length > 0
        ? await supabase
            .from("ratings")
            .select("profile_id, rating, est_classe, season:seasons!inner(est_courante)")
            .in("profile_id", idsCandidats)
            .eq("game_id", 1)
            .eq("season.est_courante", true)
        : { data: [] };
    const niveauCandidat = new Map(
      (ratingsCandidats ?? [])
        .filter((r) => r.est_classe)
        .map((r) => [r.profile_id, Number(r.rating)] as const),
    );

    return (
      <section id="recrutement" aria-labelledby="titre-recrutement" className="mt-10 flex scroll-mt-28 flex-col gap-6">
        <LibelleSection as="h2" id="titre-recrutement" className="border-b border-line-strong pb-4">
          Recrutement
        </LibelleSection>

        {effectif >= 5 ? (
          <p className="text-sm text-muted">
            {typographie("Ton équipe a cinq joueurs : elle ne peut pas recruter. Libère une place pour publier une annonce.")}
          </p>
        ) : (
          <Panneau className={PANNEAU_FORM}>
            {annonce && !active && !dansLeFutur(annonce.expire_le) && (
              <p className="text-sm text-text-2">
                {typographie(
                  `Ton annonce a expiré le ${formaterDate(annonce.expire_le)} : publie-la de nouveau pour la remettre en ligne pour 30 jours.`,
                )}
              </p>
            )}
            {active && annonce && (
              <p className="text-sm text-text-2">
                {typographie(
                  `Annonce en ligne jusqu'au ${formaterDate(annonce.expire_le)} : ${libellePostes(annonce.postes)}${
                    niveau ? ` · ${niveau}` : ""
                  } · ${annonce.region}. Modifie-la ci-dessous ou retire-la.`,
                )}
              </p>
            )}
            <form action={publierRecrutement} className="flex flex-col gap-5">
              <input type="hidden" name="team_id" value={equipe.id} />
              <input type="hidden" name="slug" value={equipe.slug} />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 font-texte text-mini font-medium text-muted uppercase">Postes recherchés</legend>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <Pastille key={r} name="postes" value={r} defaultChecked={annonce?.postes.includes(r) ?? false}>
                      {LABEL_ROLE[r]}
                    </Pastille>
                  ))}
                </div>
              </fieldset>
              <Champ
                libelle="Niveau minimum"
                idAide="aide-niveau-recrutement"
                aide={`Rating Najarena de la saison du candidat (${RATING_DEPART} s'il n'a pas encore joué).`}
              >
                <select
                  name="niveau_min"
                  defaultValue={annonce?.niveau_min ?? ""}
                  aria-describedby="aide-niveau-recrutement"
                  className={classeChamp()}
                >
                  <option value="">Tous niveaux</option>
                  {CHOIX_NIVEAU_RECRUTEMENT.map((c) => (
                    <option key={c.valeur} value={c.valeur}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ libelle="Message (facultatif)">
                <textarea
                  name="message"
                  rows={3}
                  maxLength={MESSAGE_RECRUTEMENT_MAX}
                  defaultValue={annonce?.message ?? ""}
                  placeholder="Ex. « On prépare Clash, entraînements le mardi et le jeudi soir. »"
                  className={`${classeChamp()} resize-none`}
                />
              </Champ>
              <p className="text-xs text-muted">
                {typographie(
                  "Visible de tous sur « Équipes qui recrutent », pour 30 jours, sur la région de ton compte Riot. Les joueurs vérifiés de cette région, au bon niveau, peuvent postuler.",
                )}
              </p>
              <div>
                <BoutonEnvoi libelleEnCours="Publication…">{active ? "Mettre à jour l'annonce" : "Publier l'annonce"}</BoutonEnvoi>
              </div>
            </form>
            {active && (
              <form action={retirerRecrutement}>
                <input type="hidden" name="team_id" value={equipe.id} />
                <input type="hidden" name="slug" value={equipe.slug} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-text"
                >
                  Retirer l&apos;annonce
                </button>
              </form>
            )}
          </Panneau>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="font-texte text-mini font-medium text-muted uppercase">
            Candidatures reçues · {enCours.length}
          </h3>
          {enCours.length === 0 ? (
            <p className="text-sm text-muted">Aucune candidature en attente.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {enCours.map((c) => (
                <li key={c.id}>
                  <Panneau className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-sm">
                        {c.profile?.slug ? (
                          <Link href={`/joueur/${c.profile.slug}`} className="font-semibold hover:text-accent">
                            {c.profile.pseudo}
                          </Link>
                        ) : (
                          <span className="font-semibold">Joueur</span>
                        )}
                        <span className="text-muted tabular-nums">
                          {" "}
                          · {estRole(c.poste) ? LABEL_ROLE[c.poste] : c.poste} ·{" "}
                          {niveauCandidat.has(c.profile_id)
                            ? `Rating ${arrondir(niveauCandidat.get(c.profile_id)!)} (${palierDuRating(niveauCandidat.get(c.profile_id)!)})`
                            : "Pas encore classé"}{" "}
                          · {formaterDate(c.cree_le)}
                        </span>
                      </p>
                      {c.message && <p className="text-sm text-text-2 [overflow-wrap:anywhere]">{c.message}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <form action={repondreCandidature}>
                        <input type="hidden" name="candidature_id" value={c.id} />
                        <input type="hidden" name="slug" value={equipe.slug} />
                        <input type="hidden" name="reponse" value="accepter" />
                        <BoutonEnvoi libelleEnCours="Ajout…" aria-describedby={`effet-accepter-${c.id}`}>
                          Accepter
                        </BoutonEnvoi>
                        <span id={`effet-accepter-${c.id}`} className="sr-only">
                          ajoute ce joueur à l&apos;équipe
                        </span>
                      </form>
                      <form action={repondreCandidature}>
                        <input type="hidden" name="candidature_id" value={c.id} />
                        <input type="hidden" name="slug" value={equipe.slug} />
                        <input type="hidden" name="reponse" value="decliner" />
                        <BoutonEnvoi variante="contour" libelleEnCours="Envoi…">
                          Décliner
                        </BoutonEnvoi>
                      </form>
                    </div>
                  </Panneau>
                </li>
              ))}
            </ul>
          )}
        </div>

        {active && (
          <div className="flex flex-col gap-3">
            <h3 className="font-texte text-mini font-medium text-muted uppercase">
              Joueurs qui cherchent une équipe et te correspondent · {(propositions ?? []).length}
            </h3>
            {(propositions ?? []).length === 0 ? (
              <p className="text-sm text-muted">
                {typographie(
                  "Personne pour l'instant : aucun joueur de ta région, au poste et au niveau demandés, n'a d'annonce « cherche une équipe ».",
                )}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {(propositions ?? []).map((p) => (
                  <li key={p.profile_id}>
                    <Panneau className="flex h-full flex-col gap-3 p-5">
                      <p className="text-sm">
                        <Link href={`/joueur/${p.slug}`} className="font-semibold hover:text-accent">
                          {p.pseudo}
                        </Link>
                        <span className="text-muted tabular-nums">
                          {" "}
                          · {p.role_prefere && estRole(p.role_prefere) ? LABEL_ROLE[p.role_prefere] : "Poste non indiqué"} ·{" "}
                          {p.rating !== null ? `Rating ${arrondir(Number(p.rating))}` : "Pas encore classé"}
                        </span>
                      </p>
                      {p.message && <p className="text-sm text-text-2 [overflow-wrap:anywhere]">{p.message}</p>}
                      <form action={inviterMembre} className="mt-auto">
                        <input type="hidden" name="team_id" value={equipe.id} />
                        <input type="hidden" name="slug" value={equipe.slug} />
                        <input type="hidden" name="profile_id" value={p.profile_id} />
                        <BoutonEnvoi variante="contour" libelleEnCours="Invitation…">
                          Inviter dans l&apos;équipe
                        </BoutonEnvoi>
                      </form>
                    </Panneau>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    );
  }

  // Visiteur : rien si l'équipe ne recrute pas, ni si son capitaine est
  // suspendu, supprimé ou bloqué (mêmes règles que la liste publique).
  if (!active || !annonce) return null;
  const { data: visible } = await supabase.rpc("annonce_recrutement_visible", { p_team: equipe.id });
  if (!visible) return null;

  const [{ data: maCandidatureBrute }, { data: monRating }] = await Promise.all([
    visiteurId && !estMembre
      ? supabase
          .from("candidatures_equipe")
          .select("id, poste, cree_le")
          .eq("team_id", equipe.id)
          .eq("profile_id", visiteurId)
          .eq("statut", "en_attente")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    visiteurId && annonce.niveau_min !== null
      ? supabase
          .from("ratings")
          .select("rating, season:seasons!inner(est_courante)")
          .eq("profile_id", visiteurId)
          .eq("game_id", 1)
          .eq("season.est_courante", true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // Plus de 14 jours sans réponse : expirée (le capitaine ne la voit plus,
  // et la base la clôt à la prochaine candidature) — on propose de repostuler.
  const maCandidature = maCandidatureBrute && candidatureEnCours(maCandidatureBrute.cree_le) ? maCandidatureBrute : null;
  const ratingVisiteur = monRating ? Number(monRating.rating) : RATING_DEPART;
  const niveauOk = annonce.niveau_min === null || ratingVisiteur >= annonce.niveau_min;

  let action: ReactNode;
  if (!visiteurId) {
    action = (
      <BoutonLien href={`/connexion?suite=${encodeURIComponent(`/equipe/${equipe.slug}#recrutement`)}`} variante="contour">
        Se connecter pour postuler
      </BoutonLien>
    );
  } else if (estMembre) {
    action = <p className="text-sm text-muted">Tu fais partie de cette équipe.</p>;
  } else if (maCandidature) {
    action = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-text-2">
          {typographie(
            `Ta candidature (${estRole(maCandidature.poste) ? LABEL_ROLE[maCandidature.poste] : maCandidature.poste}), envoyée le ${formaterDate(maCandidature.cree_le)}, attend la réponse du capitaine.`,
          )}
        </p>
        <form action={annulerCandidature}>
          <input type="hidden" name="candidature_id" value={maCandidature.id} />
          <input type="hidden" name="slug" value={equipe.slug} />
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-3 hover:text-text"
          >
            Retirer ma candidature
          </button>
        </form>
      </div>
    );
  } else if (!regionVisiteur) {
    action = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted">
          {typographie("Pour postuler, lie et vérifie ton compte Riot : il fixe ta région et permet de lire tes résultats.")}
        </p>
        <BoutonLien href="/lier-riot" variante="contour">
          Lier mon Riot ID
        </BoutonLien>
      </div>
    );
  } else if (regionVisiteur !== annonce.region) {
    action = (
      <p className="text-sm text-muted">
        {typographie(`Cette équipe recrute sur ${annonce.region} : ton compte Riot vérifié est sur ${regionVisiteur}.`)}
      </p>
    );
  } else if (!niveauOk) {
    action = (
      <p className="text-sm text-muted">
        {typographie(
          `L'équipe demande le niveau ${niveau ?? libelleNiveauRecrutement(annonce.niveau_min)}. ${
            monRating
              ? `Ton rating de la saison : ${arrondir(ratingVisiteur)} (${palierDuRating(ratingVisiteur)})`
              : `Tu n'as pas encore joué cette saison : ton rating compte pour ${arrondir(RATING_DEPART)} (${palierDuRating(RATING_DEPART)})`
          }, il te manque ${arrondir((annonce.niveau_min ?? 0) - ratingVisiteur)} points.`,
        )}
      </p>
    );
  } else {
    action = (
      <form action={postulerEquipe} className="flex flex-col gap-4">
        <input type="hidden" name="team_id" value={equipe.id} />
        <input type="hidden" name="slug" value={equipe.slug} />
        <Champ libelle="Poste">
          <select name="poste" required defaultValue="" className={classeChamp()}>
            <option value="" disabled>
              Choisis ton poste
            </option>
            {annonce.postes.filter(estRole).map((p) => (
              <option key={p} value={p}>
                {LABEL_ROLE[p]}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Message au capitaine (facultatif)">
          <textarea
            name="message"
            rows={3}
            maxLength={MESSAGE_RECRUTEMENT_MAX}
            placeholder="Ex. « Main Nautilus et Rell, dispo en semaine après 20 h. »"
            className={`${classeChamp()} resize-none`}
          />
        </Champ>
        <div>
          <BoutonEnvoi libelleEnCours="Envoi…">Postuler</BoutonEnvoi>
        </div>
      </form>
    );
  }

  return (
    <section id="recrutement" aria-labelledby="titre-recrutement" className="mt-10 flex scroll-mt-28 flex-col gap-4">
      <LibelleSection as="h2" id="titre-recrutement" className="border-b border-line-strong pb-4">
        Cette équipe recrute
      </LibelleSection>
      <Panneau className="flex max-w-2xl flex-col gap-4 p-6">
        <p className="text-sm text-text">
          {libellePostes(annonce.postes)}
          <span className="text-muted">
            {" "}
            · {niveau ?? "tous niveaux"} · {annonce.region} · {effectif}/5 joueurs
          </span>
        </p>
        {annonce.message && <p className="text-sm text-text-2 [overflow-wrap:anywhere]">{annonce.message}</p>}
        {action}
      </Panneau>
    </section>
  );
}
