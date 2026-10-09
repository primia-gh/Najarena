import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { REGIONS } from "@/lib/regions";
import { heureParis, jourLisibleParis, jourParis } from "@/lib/tournois-auto/creneaux";
import {
  AVANCE_MAX_HEURES,
  DISPONIBILITES_MAX,
  HEURE_DERNIERE,
  HEURE_PREMIERE,
  heuresProposees,
  SEUIL_A_LA_DEMANDE,
  type JourPropose,
} from "@/lib/a-la-demande";
import { JOUEURS_MIN_TOURNOI_CLASSE, PREAVIS_TOURNOI_CLASSE_HEURES } from "@/lib/tournoi-classe";
import { declarerDisponibilite, retirerDisponibilite } from "@/lib/disponibilite-actions";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonLien from "@/components/design/BoutonLien";
import FondEcailles from "@/components/design/FondEcailles";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";
import Panneau from "@/components/design/Panneau";

// Tournois à la demande (09/10/2026, idée en réserve n°11) : chacun indique
// les heures où il est libre ; dès que SEUIL_A_LA_DEMANDE joueurs d'une même
// région ont choisi la même heure, un tournoi s'ouvre et ils y sont inscrits
// (tâche des tournois automatiques, lib/a-la-demande-serveur.ts). Les
// nombres sont publics, jamais les noms.

export const metadata: Metadata = {
  title: "Tournois à la demande — Najarena",
  description:
    "Indique quand tu es libre : dès que 8 joueurs de ta région le sont à la même heure, un tournoi League of Legends 1v1 s'ouvre.",
  alternates: { canonical: "/lol/a-la-demande" },
};

interface PageProps {
  searchParams: Promise<{ region?: string; erreur?: string; message?: string }>;
}

// Hors du composant (règle de pureté du rendu).
function joursAVenir(): { jours: JourPropose[]; aujourdhui: string; maintenantMs: number } {
  const maintenant = new Date();
  return { jours: heuresProposees(maintenant), aujourdhui: jourParis(maintenant), maintenantMs: maintenant.getTime() };
}

function libelleJour(jour: string, aujourdhui: string, exempleIso: string): string {
  const demain = new Date(`${aujourdhui}T12:00:00Z`);
  demain.setUTCDate(demain.getUTCDate() + 1);
  if (jour === aujourdhui) return "Aujourd'hui";
  if (jour === demain.toISOString().slice(0, 10)) return "Demain";
  const texte = jourLisibleParis(exempleIso);
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

const cle = (iso: string) => new Date(iso).getTime();

export default async function ALaDemandePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const moi = userData.user?.id ?? null;

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
  // Un joueur vérifié voit sa région ; un visiteur choisit celle qu'il regarde.
  const regionDemandee = REGIONS.some((r) => r.code === params.region) ? params.region! : "EUW";
  const region = compteVerifie && compte ? compte.region : regionDemandee;

  const { jours, aujourdhui, maintenantMs } = joursAVenir();
  const [{ data: comptes }, { data: miennes }, { data: prevus }] = await Promise.all([
    supabase.rpc("disponibilites_creneaux", { p_region: region }),
    moi ? supabase.from("disponibilites").select("debut") : Promise.resolve({ data: [] as { debut: string }[] }),
    supabase
      .from("tournaments")
      .select("slug, nom, debute_le")
      .eq("region", region)
      .eq("nature", "tournoi")
      .not("creneau_auto", "is", null)
      .in("statut", ["ouvert", "checkin"]),
  ]);
  const nombreA = new Map((comptes ?? []).map((c) => [cle(c.debut), c.joueurs]));
  const mesHeures = new Set((miennes ?? []).map((d) => cle(d.debut)));
  const tournoiA = new Map((prevus ?? []).map((t) => [cle(t.debute_le), t]));
  const mesProchaines = [...mesHeures].filter((t) => t > maintenantMs).length;
  const peutIndiquer = Boolean(moi && compteVerifie);

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
          <h1 className="font-titre text-section font-black tracking-[1px] uppercase">Tournois à la demande</h1>
          <p className="max-w-2xl text-courant text-text-2">
            Indique les heures où tu peux jouer. Dès que {SEUIL_A_LA_DEMANDE} joueurs de ta région sont libres à la même
            heure, un tournoi 1v1 s&apos;ouvre et vous y êtes inscrits. Personne ne voit qui est disponible : seulement
            combien.
          </p>
        </Apparition>

        <Apparition delai={0.06}>
          <ul className="grid max-w-5xl gap-6 border-y border-line py-6 md:grid-cols-3">
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Quand</span>
              <span className="text-sm text-text-2">
                Heures pleines de {HEURE_PREMIERE} h à {HEURE_DERNIERE} h (Paris), jusqu&apos;à {AVANCE_MAX_HEURES / 24}{" "}
                jours à l&apos;avance, {DISPONIBILITES_MAX} au plus.
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Ensuite</span>
              <span className="text-sm text-text-2">
                Tu es prévenu à l&apos;ouverture (notification, Discord). Le tournoi reste ouvert à tous ; le check-in
                ouvre 30 minutes avant.
              </span>
            </li>
            <li className="flex flex-col gap-1.5">
              <span className="font-texte text-mini font-medium text-muted uppercase">Classement</span>
              <span className="text-sm text-text-2">
                Il compte s&apos;il s&apos;ouvre au moins {PREAVIS_TOURNOI_CLASSE_HEURES} h avant son début et réunit{" "}
                {JOUEURS_MIN_TOURNOI_CLASSE} joueurs au départ.{" "}
                <Link href="/comment-ca-marche#tournois-classes" className="text-text underline underline-offset-3 hover:text-accent">
                  Indique tes heures tôt
                </Link>
                .
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

        <section id="heures" aria-labelledby="titre-heures" className="flex scroll-mt-28 flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-strong pb-4">
            <LibelleSection as="h2" id="titre-heures">
              Heures à venir · {region}
            </LibelleSection>
            {moi && compteVerifie && (
              <span className="text-sm text-muted tabular-nums">
                {mesProchaines}/{DISPONIBILITES_MAX} heures indiquées
              </span>
            )}
          </div>

          {!moi ? (
            <Panneau className="flex max-w-2xl flex-col items-start gap-4 p-6">
              <p className="text-text-2">Connecte-toi pour indiquer tes heures. Les nombres ci-dessous sont ceux de la région {region}.</p>
              <BoutonLien href={`/connexion?suite=${encodeURIComponent("/lol/a-la-demande")}`}>Se connecter</BoutonLien>
              <nav aria-label="Choisir la région" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {REGIONS.map((r) => (
                  <Link
                    key={r.code}
                    href={`/lol/a-la-demande?region=${r.code}#heures`}
                    aria-current={r.code === region ? "true" : undefined}
                    className={`inline-flex min-h-11 items-center ${r.code === region ? "font-semibold text-text" : "text-muted hover:text-text"}`}
                  >
                    {r.code}
                  </Link>
                ))}
              </nav>
            </Panneau>
          ) : !compteVerifie ? (
            <Panneau className="flex max-w-2xl flex-col items-start gap-4 p-6">
              <p className="text-text-2">
                Il faut un compte Riot vérifié : c&apos;est lui qui fixe ta région et permet de lire tes résultats.
              </p>
              <BoutonLien href={`/lier-riot?suite=${encodeURIComponent("/lol/a-la-demande")}`}>Lier mon Riot ID</BoutonLien>
            </Panneau>
          ) : null}

          {jours.map((j) => (
            <div key={j.jour} className="flex flex-col gap-3">
              <h3 className="font-titre text-2xl font-extrabold uppercase">
                {libelleJour(j.jour, aujourdhui, j.heures[0].debut)}
              </h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {j.heures.map((h) => {
                  const t = cle(h.debut);
                  const nombre = nombreA.get(t) ?? 0;
                  const mienne = mesHeures.has(t);
                  const tournoi = tournoiA.get(t);
                  const part = Math.min(100, Math.round((nombre / SEUIL_A_LA_DEMANDE) * 100));
                  const quand = `${libelleJour(j.jour, aujourdhui, h.debut)} ${heureParis(h.debut)}`;
                  const contenu = (
                    <>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-titre text-2xl leading-none font-black tabular-nums">{h.heure}</span>
                        {mienne && <Icone nom="coche" taille={14} epaisseur={3} className="text-text" />}
                      </span>
                      {tournoi ? (
                        <span className="text-sm text-text underline underline-offset-3">Tournoi prévu</span>
                      ) : (
                        <span className="flex flex-col gap-1.5">
                          <span className="text-sm text-text-2 tabular-nums">
                            <span className="font-semibold text-text">{nombre}</span>/{SEUIL_A_LA_DEMANDE} joueurs
                          </span>
                          <span className="block h-1 w-full overflow-hidden rounded-full bg-line-strong" aria-hidden="true">
                            <span className="block h-full rounded-full bg-text-2" style={{ width: `${part}%` }} />
                          </span>
                        </span>
                      )}
                      {!tournoi && peutIndiquer && (
                        <span className="font-texte text-mini font-semibold text-muted uppercase group-hover:text-text">
                          {mienne ? "Je suis dispo · retirer" : "+ Je suis dispo"}
                        </span>
                      )}
                    </>
                  );
                  const classe = `group flex h-full w-full flex-col gap-3 rounded-carte border p-4 text-left transition-colors duration-200 ${
                    mienne ? "border-text bg-[rgba(245,245,244,0.03)]" : "border-line-strong"
                  }`;
                  const interactif =
                    "cursor-pointer hover:border-[rgba(245,245,244,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
                  return (
                    <li key={h.debut}>
                      {tournoi ? (
                        <Link href={`/lol/tournois/${tournoi.slug}`} className={`${classe} ${interactif}`} aria-label={`${quand} : tournoi prévu`}>
                          {contenu}
                        </Link>
                      ) : peutIndiquer ? (
                        <form action={mienne ? retirerDisponibilite : declarerDisponibilite} className="h-full">
                          <input type="hidden" name="debut" value={h.debut} />
                          <button
                            type="submit"
                            aria-pressed={mienne}
                            aria-label={`${quand}, ${nombre} joueur${nombre > 1 ? "s" : ""} sur ${SEUIL_A_LA_DEMANDE} : ${mienne ? "retirer ma disponibilité" : "je suis disponible"}`}
                            className={`${classe} ${interactif}`}
                          >
                            {contenu}
                          </button>
                        </form>
                      ) : (
                        <div className={classe}>{contenu}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
