import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { REGIONS } from "@/lib/regions";
import { candidatureExpiree, DUREE_CANDIDATURE_JOURS, libelleNiveauRecrutement, libellePostes } from "@/lib/recrutement";
import { LABEL_ROLE } from "@/lib/roles";
import { estRole } from "@/lib/duo";
import { formaterDate } from "@/lib/tournois";
import { classeChamp } from "@/lib/design";
import { typographie } from "@/lib/typographie";
import Apparition from "@/components/design/Apparition";
import EnTetePage from "@/components/design/EnTetePage";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

// Équipes qui recrutent (19/11/2026) : les annonces des capitaines, sur la
// région du visiteur (ou celle qu'il choisit). On postule depuis la page de
// l'équipe, où la base revérifie région, niveau et délais.

export const metadata: Metadata = {
  alternates: { canonical: "/lol/recrutement" },
  title: "Équipes qui recrutent — Najarena",
  description:
    "Les équipes League of Legends qui cherchent un joueur sur Najarena : postes recherchés, niveau demandé, effectif. Postule avec ton compte Riot vérifié.",
};

const LIBELLE_STATUT: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Déclinée",
  annulee: "Retirée",
  expiree: "Expirée",
};

// Hors du composant : la date courante ne se lit pas pendant le rendu.
// Une candidature en attente depuis 14 jours s'affiche « Expirée », comme
// sur la page d'équipe (le capitaine ne la voit plus).
function statutAffiche(statut: string, creeLe: string): string {
  return candidatureExpiree(statut, creeLe, Date.now()) ? "expiree" : statut;
}

interface PageProps {
  searchParams: Promise<{ region?: string }>;
}

export default async function RecrutementPage({ searchParams }: PageProps) {
  const { region: regionDemandee } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const moi = userData.user?.id ?? null;

  const [{ data: compte }, { data: candidatures }] = await Promise.all([
    moi
      ? supabase
          .from("game_accounts")
          .select("region, verifie_le, role_prefere")
          .eq("profile_id", moi)
          .eq("game_id", 1)
          .eq("est_principal", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    moi
      ? supabase
          .from("candidatures_equipe")
          .select("id, poste, statut, cree_le, team:teams(nom, tag, slug)")
          .eq("profile_id", moi)
          .order("cree_le", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);
  const regionCompte = compte?.verifie_le ? compte.region : null;
  // « Tous les serveurs » envoie region= vide : choix explicite, à respecter
  // même pour un joueur dont le compte Riot a une région. Sans paramètre, la
  // région de son compte.
  const region = REGIONS.some((r) => r.code === regionDemandee)
    ? (regionDemandee as string)
    : regionDemandee === ""
      ? null
      : regionCompte;
  const monPoste = compte?.role_prefere && estRole(compte.role_prefere) ? compte.role_prefere : null;

  const { data: annonces } = await supabase.rpc("annonces_recrutement_publiques", { p_region: region ?? undefined });

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <EnTetePage
          surtitre="League of Legends · 5v5"
          titre="Équipes qui recrutent"
          intro={typographie(
            "Les capitaines indiquent les postes qu'ils cherchent et le niveau demandé. Postule depuis la page de l'équipe avec ton compte Riot vérifié : le capitaine accepte ou décline, et sa réponse t'arrive en notification.",
          )}
          actions={
            <>
              <BoutonLien href="/lol/coequipiers" variante="contour">
                Joueurs qui cherchent une équipe
              </BoutonLien>
              <BoutonLien href="/equipe/nouvelle" variante="contour">
                Créer une équipe
              </BoutonLien>
            </>
          }
        />

        <form method="get" className="flex max-w-xl flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1.5">
            <span className="font-texte text-mini font-medium text-muted uppercase">Serveur</span>
            <select name="region" defaultValue={region ?? ""} className={classeChamp()}>
              <option value="">Tous les serveurs</option>
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.nom}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-bouton border border-line-strong px-4 text-sm hover:border-text"
          >
            Afficher
          </button>
        </form>

        {!moi && (
          <p className="max-w-3xl text-sm text-muted">
            <Link href="/connexion?suite=%2Flol%2Frecrutement" className="text-text underline underline-offset-3 hover:text-accent">
              Connecte-toi
            </Link>{" "}
            pour postuler et suivre tes candidatures.
          </p>
        )}

        {(candidatures ?? []).length > 0 && (
          <section aria-labelledby="titre-mes-candidatures" className="flex max-w-3xl flex-col gap-3">
            <LibelleSection as="h2" id="titre-mes-candidatures" className="border-b border-line-strong pb-4">
              Mes candidatures
            </LibelleSection>
            <p className="text-sm text-muted">
              {typographie(`Une candidature sans réponse expire après ${DUREE_CANDIDATURE_JOURS} jours.`)}
            </p>
            <ul className="flex flex-col">
              {(candidatures ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-sm">
                  <span>
                    {c.team ? (
                      <Link href={`/equipe/${c.team.slug}#recrutement`} className="font-semibold hover:text-accent">
                        {c.team.tag} {c.team.nom}
                      </Link>
                    ) : (
                      "Équipe supprimée"
                    )}
                    <span className="text-muted">
                      {" "}
                      · {estRole(c.poste) ? LABEL_ROLE[c.poste] : c.poste} · {formaterDate(c.cree_le)}
                    </span>
                  </span>
                  <span className={c.statut === "acceptee" ? "font-semibold text-text" : "text-muted"}>
                    {LIBELLE_STATUT[statutAffiche(c.statut, c.cree_le)] ?? c.statut}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Apparition delai={0.06}>
          <section aria-labelledby="titre-annonces" className="flex flex-col gap-6">
            <LibelleSection as="h2" id="titre-annonces" className="border-b border-line-strong pb-4">
              {region ? `Annonces · ${region}` : "Annonces"}{" "}
              <span className="text-faint tabular-nums">· {(annonces ?? []).length}</span>
            </LibelleSection>
            {(annonces ?? []).length === 0 ? (
              <Panneau reperes className="flex flex-col items-start gap-3 p-8">
                <p className="font-titre text-3xl font-black uppercase">Aucune équipe ne recrute ici.</p>
                <p className="max-w-md text-text-2">
                  {typographie(
                    "Publie une annonce « cherche une équipe » pour que les capitaines te trouvent, ou crée ton équipe et recrute.",
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  <BoutonLien href="/lol/coequipiers">Je cherche une équipe</BoutonLien>
                  <BoutonLien href="/equipe/nouvelle" variante="contour">
                    Créer une équipe
                  </BoutonLien>
                </div>
              </Panneau>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(annonces ?? []).map((a) => {
                  const niveau = libelleNiveauRecrutement(a.niveau_min);
                  const pourMoi = monPoste !== null && a.postes.includes(monPoste);
                  return (
                    <li key={a.team_id}>
                      <Panneau className="flex h-full flex-col gap-3 p-6">
                        <Link
                          href={`/equipe/${a.slug}#recrutement`}
                          className="font-titre text-2xl leading-tight font-black uppercase [overflow-wrap:anywhere] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <span className="text-muted">{a.tag}</span> {a.nom}
                        </Link>
                        <p className="text-sm text-text">
                          {libellePostes(a.postes)}
                          {pourMoi && <span className="text-muted"> · ton poste</span>}
                        </p>
                        <p className="text-sm text-muted tabular-nums">
                          {niveau ?? "Tous niveaux"} · {a.region} · {a.effectif}/5 joueurs
                        </p>
                        {a.message && <p className="text-sm text-text-2 [overflow-wrap:anywhere]">{a.message}</p>}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                          <BoutonLien href={`/equipe/${a.slug}#recrutement`} variante="contour">
                            Voir et postuler<span className="sr-only"> : {a.nom}</span>
                          </BoutonLien>
                          <p className="text-xs text-faint tabular-nums">Mise à jour le {formaterDate(a.maj_le)}</p>
                        </div>
                      </Panneau>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Apparition>
      </div>
    </main>
  );
}
