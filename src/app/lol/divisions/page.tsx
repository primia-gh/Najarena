import Link from "next/link";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import { REGIONS } from "@/lib/regions";
import { heureParis, jourLisibleParis } from "@/lib/tournois-auto/creneaux";
import {
  classementPoule,
  DELAI_PRESENCE_MINUTES,
  SEMAINES_LIGUE,
  type LigneClassement,
  type Mouvement,
} from "@/lib/divisions";
import { jeSuisLa, quitterDivision, sInscrireDivision } from "@/lib/division-actions";
import PouleDivision, { type JoueurPoule, type RencontrePoule } from "@/components/divisions/PouleDivision";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

// Divisions mensuelles (09/10/2026, idée en réserve n°13) : inscription au
// mois suivant, poules de 3 ou 4 par niveau, un match par semaine contre
// chacun (duel ordinaire lu chez Riot), montées et descentes en fin de
// mois. Règles : la base ; calculs : lib/divisions.ts ; tâche :
// lib/divisions-serveur.ts.

export const metadata: Metadata = {
  title: "Divisions — Najarena",
  description:
    "Ligue mensuelle League of Legends 1v1 : poules de ton niveau, un match par semaine contre chacun, résultats lus chez Riot, montée et descente chaque mois.",
  alternates: { canonical: "/lol/divisions" },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ region?: string; erreur?: string; message?: string }>;
}

type Client = SupabaseClient<Database>;

interface LigueAffichee {
  id: string;
  debutLe: string;
  finLe: string;
  poules: { niveau: number; classement: LigneClassement[]; rencontres: RencontrePoule[] }[];
  joueurs: Map<string, JoueurPoule>;
  /** Rencontres brutes (dispo, semaine), pour « Ma poule ». */
  brutes: Database["public"]["Functions"]["rencontres_ligue"]["Returns"];
}

async function chargerLigue(supabase: Client, ligue: { id: string; debut_le: string; fin_le: string }, finale: boolean): Promise<LigueAffichee> {
  const [{ data: poules }, { data: rencontres }] = await Promise.all([
    supabase
      .from("poules_division")
      .select("id, niveau, membres_poule_division(profile_id, ordre, rang_final, mouvement, profile:profiles(pseudo, slug))")
      .eq("ligue_id", ligue.id)
      .order("niveau", { ascending: true }),
    supabase.rpc("rencontres_ligue", { p_ligue_id: ligue.id }),
  ]);
  const joueurs = new Map<string, JoueurPoule>();
  for (const p of poules ?? []) {
    for (const m of p.membres_poule_division) {
      joueurs.set(m.profile_id, {
        id: m.profile_id,
        pseudo: m.profile?.pseudo ?? "Joueur",
        slug: m.profile?.slug ?? "",
        mouvement: (m.mouvement as Mouvement | null) ?? null,
      });
    }
  }
  const toutes = rencontres ?? [];
  return {
    id: ligue.id,
    debutLe: ligue.debut_le,
    finLe: ligue.fin_le,
    joueurs,
    brutes: toutes,
    poules: (poules ?? []).map((p) => {
      const siennes = toutes.filter((r) => r.poule_id === p.id);
      const membres = p.membres_poule_division;
      const classement = finale
        ? // Ligue terminée : l'ordre final écrit par la base, avec le bilan recalculé.
          (() => {
            const bilan = new Map(
              classementPoule(
                membres.map((m) => ({ id: m.profile_id, ordre: m.ordre })),
                siennes.map((r) => ({ joueurA: r.joueur_a, joueurB: r.joueur_b, gagnantId: r.gagnant_id, niveauVerdict: r.niveau_verdict })),
              ).map((l) => [l.id, l]),
            );
            return [...membres]
              .sort((a, b) => (a.rang_final ?? 99) - (b.rang_final ?? 99))
              .flatMap((m) => {
                const l = bilan.get(m.profile_id);
                return l ? [l] : [];
              });
          })()
        : classementPoule(
            membres.map((m) => ({ id: m.profile_id, ordre: m.ordre })),
            siennes.map((r) => ({ joueurA: r.joueur_a, joueurB: r.joueur_b, gagnantId: r.gagnant_id, niveauVerdict: r.niveau_verdict })),
          );
      return {
        niveau: p.niveau,
        classement,
        rencontres: siennes.map((r) => ({
          id: r.rencontre_id,
          semaine: r.semaine,
          joueurA: r.joueur_a,
          joueurB: r.joueur_b,
          gagnantId: r.gagnant_id,
          verifie: Boolean(r.niveau_verdict && r.niveau_verdict !== "manuel"),
          tournoiSlug: r.tournoi_slug,
          enCours: r.tournoi_statut === "en_cours",
        })),
      };
    }),
  };
}

// Hors du composant (règle de pureté du rendu).
function instantPresent(): number {
  return Date.now();
}

const dateCourte = (iso: string) => jourLisibleParis(iso);

export default async function DivisionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const moi = userData.user?.id ?? null;
  const maintenant = instantPresent();

  const compte = moi
    ? (
        await supabase
          .from("game_accounts")
          .select("region, verifie_le")
          .eq("profile_id", moi)
          .eq("game_id", 1)
          .eq("est_principal", true)
          .maybeSingle()
      ).data
    : null;
  const compteVerifie = Boolean(compte?.verifie_le);
  const regionDemandee = REGIONS.some((r) => r.code === params.region) ? params.region! : null;
  const region = regionDemandee ?? (compteVerifie && compte ? compte.region : "EUW");

  const [{ data: prochaine }, { data: enCours }, { data: precedente }, { data: debutProchain }] = await Promise.all([
    supabase
      .from("ligues_division")
      .select("id, debut_le, inscriptions_division(profile_id)")
      .eq("region", region)
      .eq("statut", "inscriptions")
      .order("debut_le", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ligues_division")
      .select("id, debut_le, fin_le")
      .eq("region", region)
      .eq("statut", "en_cours")
      .order("debut_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ligues_division")
      .select("id, debut_le, fin_le")
      .eq("region", region)
      .eq("statut", "terminee")
      .order("debut_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("prochain_debut_division"),
  ]);
  const [ligueEnCours, liguePrecedente] = await Promise.all([
    enCours ? chargerLigue(supabase, enCours, false) : Promise.resolve(null),
    precedente ? chargerLigue(supabase, precedente, true) : Promise.resolve(null),
  ]);

  const inscrits = prochaine?.inscriptions_division.length ?? 0;
  const jeSuisInscrit = Boolean(moi && prochaine?.inscriptions_division.some((i) => i.profile_id === moi));
  const debutAffiche = prochaine?.debut_le ?? debutProchain ?? null;
  const regionDuCompte = compteVerifie && compte?.region === region;

  // « Ma poule » : mes rencontres de la ligue en cours.
  const mesRencontres = moi && ligueEnCours ? ligueEnCours.brutes.filter((r) => r.joueur_a === moi || r.joueur_b === moi) : [];
  const nomDe = (id: string) => ligueEnCours?.joueurs.get(id)?.pseudo ?? "Joueur";
  const recent = (iso: string | null) => Boolean(iso && maintenant - Date.parse(iso) < DELAI_PRESENCE_MINUTES * 60_000);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-12 px-grille">
        <Apparition className="flex flex-col gap-5">
          <Link
            href="/lol/tournois"
            className="inline-flex min-h-11 items-center gap-2 self-start font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Tournois
          </Link>
          <LibelleSection>League of Legends · 1v1</LibelleSection>
          <h1 className="font-titre text-section font-black tracking-[1px] uppercase">Divisions</h1>
          <p className="max-w-2xl text-courant text-text-2">
            Une ligue par mois : des poules de joueurs de ton niveau, un match par semaine contre chacun, résultats lus
            chez Riot. Le premier de chaque poule monte, le dernier descend.
          </p>
        </Apparition>

        <Apparition delai={0.06}>
          <ul className="grid max-w-5xl gap-6 border-y border-line py-6 md:grid-cols-3">
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Inscription</span>
              <span className="text-sm text-text-2">
                Pour le mois suivant, avec un compte Riot vérifié. La ligue démarre le premier lundi du mois et dure{" "}
                {SEMAINES_LIGUE} semaines.
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Matchs</span>
              <span className="text-sm text-text-2">
                Poules de 4 (ou 3) : un adversaire par semaine, la 4ᵉ semaine pour rattraper. Mettez-vous d&apos;accord sur
                l&apos;heure, puis cliquez tous les deux « Je suis là » à moins de {DELAI_PRESENCE_MINUTES} minutes
                d&apos;écart : le duel se lance, lu chez Riot, classé comme un défi.
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Fin du mois</span>
              <span className="text-sm text-text-2">
                Classement par victoires, puis victoires lues chez Riot, puis confrontation directe. Le premier monte
                d&apos;une poule, le dernier descend ; les nouveaux entrent selon leur rating.
              </span>
            </li>
          </ul>
        </Apparition>

        {(params.erreur || params.message) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {params.erreur && <Alerte type="erreur">{params.erreur}</Alerte>}
            {params.message && <Alerte type="succes">{params.message}</Alerte>}
          </div>
        )}

        <nav aria-label="Choisir la région" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {REGIONS.map((r) => (
            <Link
              key={r.code}
              href={`/lol/divisions?region=${r.code}`}
              aria-current={r.code === region ? "true" : undefined}
              className={`inline-flex min-h-11 items-center ${r.code === region ? "font-semibold text-text" : "text-muted hover:text-text"}`}
            >
              {r.code}
            </Link>
          ))}
        </nav>

        {/* Prochaine ligue : inscription. */}
        <section id="inscription" aria-labelledby="titre-inscription" className="flex max-w-2xl scroll-mt-28 flex-col gap-4">
          <LibelleSection as="h2" id="titre-inscription">
            Prochaine ligue · {region}
          </LibelleSection>
          <Panneau className="flex flex-col items-start gap-4 p-6">
            <p className="text-text-2">
              {debutAffiche ? (
                <>
                  Début le <span className="font-semibold text-text">{dateCourte(debutAffiche)}</span> à 00 h (heure de
                  Paris).{" "}
                </>
              ) : null}
              <span className="tabular-nums">{inscrits}</span> inscrit{inscrits > 1 ? "s" : ""} pour l&apos;instant
              {inscrits < 3 ? " (3 au moins pour une poule)" : ""}.
            </p>
            {!moi ? (
              <BoutonLien href={`/connexion?suite=${encodeURIComponent("/lol/divisions")}`}>Se connecter pour s&apos;inscrire</BoutonLien>
            ) : !compteVerifie ? (
              <BoutonLien href={`/lier-riot?suite=${encodeURIComponent("/lol/divisions")}`}>Lier mon Riot ID</BoutonLien>
            ) : !regionDuCompte ? (
              <p className="text-sm text-muted">Ton compte Riot est sur {compte?.region} : ta ligue est celle de cette région.</p>
            ) : jeSuisInscrit ? (
              <form action={quitterDivision} className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-accent uppercase">Inscrit</span>
                <BoutonEnvoi variante="contour" libelleEnCours="…">
                  Me désinscrire
                </BoutonEnvoi>
              </form>
            ) : (
              <form action={sInscrireDivision}>
                <BoutonEnvoi libelleEnCours="Inscription…">M&apos;inscrire à la ligue</BoutonEnvoi>
              </form>
            )}
          </Panneau>
        </section>

        {/* Mes matchs de la ligue en cours. */}
        {ligueEnCours && mesRencontres.length > 0 && (
          <section id="ma-poule" aria-labelledby="titre-ma-poule" className="flex max-w-3xl scroll-mt-28 flex-col gap-4">
            <LibelleSection as="h2" id="titre-ma-poule">
              Mes matchs de division
            </LibelleSection>
            <ul className="flex flex-col gap-3">
              {mesRencontres.map((r) => {
                const adversaire = r.joueur_a === moi ? r.joueur_b : r.joueur_a;
                const maDispo = r.joueur_a === moi ? r.dispo_a : r.dispo_b;
                const saDispo = r.joueur_a === moi ? r.dispo_b : r.dispo_a;
                const ouverture = Date.parse(ligueEnCours.debutLe) + (r.semaine - 1) * 7 * 86_400_000;
                const fini = maintenant >= Date.parse(ligueEnCours.finLe);
                return (
                  <li key={r.rencontre_id}>
                    <Panneau className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-mini text-muted uppercase tabular-nums">Semaine {r.semaine}</span>
                        <span className="text-text">
                          Contre <span className="font-semibold">{nomDe(adversaire)}</span>
                        </span>
                        {!r.gagnant_id && recent(saDispo) && (
                          <span className="text-sm text-accent">
                            {nomDe(adversaire)} est là depuis {heureParis(saDispo!)} : clique pour lancer le match.
                          </span>
                        )}
                        {!r.gagnant_id && !recent(saDispo) && recent(maDispo) && (
                          <span className="text-sm text-text-2">
                            Tu es là depuis {heureParis(maDispo!)} : on attend {nomDe(adversaire)}.
                          </span>
                        )}
                      </div>
                      {r.gagnant_id ? (
                        <span className="text-sm">
                          <span className={`font-semibold uppercase ${r.gagnant_id === moi ? "text-text" : "text-text-2"}`}>
                            {r.gagnant_id === moi ? "Victoire" : "Défaite"}
                          </span>{" "}
                          <span className="text-muted">· {r.niveau_verdict === "manuel" ? "forfait" : "✓ vérifié"}</span>
                        </span>
                      ) : r.tournoi_statut === "en_cours" && r.tournoi_slug ? (
                        <BoutonLien href={`/lol/tournois/${r.tournoi_slug}#ton-match`}>Salle de match</BoutonLien>
                      ) : fini ? (
                        <span className="text-sm text-muted">Non joué</span>
                      ) : maintenant < ouverture ? (
                        <span className="text-sm text-muted">À partir du {dateCourte(new Date(ouverture).toISOString())}</span>
                      ) : (
                        <form action={jeSuisLa}>
                          <input type="hidden" name="rencontre" value={r.rencontre_id} />
                          <BoutonEnvoi variante={recent(saDispo) ? "principal" : "contour"} libelleEnCours="…">
                            Je suis là
                          </BoutonEnvoi>
                        </form>
                      )}
                    </Panneau>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Ligue en cours. */}
        <section aria-labelledby="titre-en-cours" className="flex scroll-mt-28 flex-col gap-6">
          <LibelleSection as="h2" id="titre-en-cours">
            Ligue en cours · {region}
          </LibelleSection>
          {ligueEnCours ? (
            <>
              <p className="text-sm text-muted">
                Du {dateCourte(ligueEnCours.debutLe)} au{" "}
                {dateCourte(new Date(Date.parse(ligueEnCours.finLe) - 60_000).toISOString())}.
              </p>
              <div className="grid gap-10 xl:grid-cols-2">
                {ligueEnCours.poules.map((p) => (
                  <PouleDivision
                    key={p.niveau}
                    niveau={p.niveau}
                    classement={p.classement}
                    joueurs={ligueEnCours.joueurs}
                    rencontres={p.rencontres}
                    finale={false}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Pas de ligue en cours sur {region} : inscris-toi à la prochaine.</p>
          )}
        </section>

        {liguePrecedente && (
          <section aria-labelledby="titre-precedente" className="flex flex-col gap-6">
            <LibelleSection as="h2" id="titre-precedente">
              Ligue précédente · {region}
            </LibelleSection>
            <div className="grid gap-10 xl:grid-cols-2">
              {liguePrecedente.poules.map((p) => (
                <PouleDivision
                  key={p.niveau}
                  niveau={p.niveau}
                  classement={p.classement}
                  joueurs={liguePrecedente.joueurs}
                  rencontres={p.rencontres}
                  finale
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
