import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { creerTournoi } from "@/lib/tournoi-actions";
import { REGIONS } from "@/lib/regions";
import { JOUEURS_MIN_TOURNOI_CLASSE, PREAVIS_TOURNOI_CLASSE_HEURES } from "@/lib/tournoi-classe";
import { CONDITIONS_VICTOIRE } from "@/lib/conditions-1v1";
import { chargerOffre } from "@/lib/offres";
import { AssistantOrganisateur } from "@/components/AssistantOrganisateur";
import { classeChamp } from "@/lib/design";
import Alerte from "@/components/design/Alerte";
import Apparition from "@/components/design/Apparition";
import BoutonEnvoi from "@/components/design/BoutonEnvoi";
import FondEcailles from "@/components/design/FondEcailles";
import { Champ, Choix, GroupeFormulaire } from "@/components/design/Formulaire";
import Icone from "@/components/design/Icone";
import LibelleSection from "@/components/design/LibelleSection";

export const metadata: Metadata = {
  title: "Organiser un tournoi — Najarena",
  robots: { index: false, follow: false },
};

const CAPACITES = [4, 8, 16, 32, 64];
const CAPACITE_ETENDUE = 128;

interface OrganiserNouveauPageProps {
  // Pré-remplissage (commande /organiser du bot Discord, page d'une
  // communauté) : simples valeurs par défaut, toutes revérifiées à l'envoi.
  searchParams: Promise<{
    erreur?: string;
    nom?: string;
    debut?: string;
    checkin?: string;
    capacite?: string;
    region?: string;
    communaute?: string;
  }>;
}

const DATE_SAISIE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export default async function OrganiserNouveauPage({
  searchParams,
}: OrganiserNouveauPageProps) {
  const { erreur, nom: nomPropose, debut, checkin, capacite: capacitePropose, region: regionProposee, communaute } =
    await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const [{ offre }, { data: communautesData }] = await Promise.all([
    chargerOffre(supabase, userData.user.id),
    // Communautés où il peut publier (audit N30) : fondateur ou administrateur.
    supabase
      .from("membres_communaute")
      .select("communaute:communautes(id, slug, nom)")
      .eq("profile_id", userData.user.id)
      .in("role", ["proprietaire", "admin"]),
  ]);
  const estOrganisateurPremium = offre === "organisateur";
  const mesCommunautes = (communautesData ?? []).flatMap((m) => (m.communaute ? [m.communaute] : []));
  const communauteParDefaut = mesCommunautes.find((c) => c.slug === communaute)?.id ?? "";
  const capaciteParDefaut = CAPACITES.includes(Number(capacitePropose)) ? String(Number(capacitePropose)) : "8";
  const regionParDefaut = REGIONS.some((r) => r.code === regionProposee) ? (regionProposee ?? "") : "";

  // Revue visuelle du 09/10/2026 : mêmes champs (noms et identifiants
  // inchangés, l'assistant les remplit par identifiant), regroupés en
  // étapes numérotées ; format et publication en cartes à choisir.
  let n = 0;
  const numero = () => String(++n).padStart(2, "0");

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative flex flex-col gap-10 px-grille *:max-w-xl">
        <Apparition>
          <Link
            href="/moi"
            className="inline-flex min-h-11 items-center gap-2 font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
          >
            <Icone nom="fleche-gauche" taille={14} />
            Mon compte
          </Link>
          <LibelleSection className="mt-6">League of Legends</LibelleSection>
          <h1 className="mt-3 font-titre text-sous-titre font-black uppercase">Organiser un tournoi</h1>
          <p className="mt-4 text-text-2">
            En 1v1 ou en 5v5. Une fois publié, ton tournoi apparaît immédiatement dans la liste et les joueurs peuvent
            s&apos;inscrire ; en brouillon, il reste visible de toi seul.
          </p>
          {estOrganisateurPremium && (
            <Link
              href="/lol/recherche"
              className="mt-3 inline-flex min-h-11 items-center text-sm text-text underline underline-offset-3 hover:text-accent"
            >
              Rechercher des joueurs à recruter
            </Link>
          )}
        </Apparition>

        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        {Boolean(process.env.ANTHROPIC_API_KEY) && (
          <Apparition delai={0.06}>
            <AssistantOrganisateur />
          </Apparition>
        )}

        <Apparition delai={0.1}>
          <form action={creerTournoi} className="flex flex-col gap-12">
            <GroupeFormulaire numero={numero()} titre="Le tournoi" id="groupe-tournoi">
              <Champ libelle="Nom du tournoi">
                <input
                  id="nom"
                  name="nom"
                  type="text"
                  required
                  minLength={3}
                  maxLength={60}
                  placeholder="Ex. Tournoi du jeudi soir"
                  defaultValue={nomPropose?.slice(0, 60) ?? ""}
                  className={classeChamp()}
                />
              </Champ>

              {/* Format (audit N21) : en 5v5, les capitaines inscrivent leur équipe. */}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 font-texte text-mini font-medium text-muted uppercase">Format</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choix name="format" value="1v1" defaultChecked titre="1v1" detail="Chaque joueur s'inscrit lui-même." />
                  <Choix
                    name="format"
                    value="5v5"
                    titre="5v5"
                    detail="Le capitaine inscrit son équipe de cinq. Hors classement individuel."
                  />
                </div>
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <Champ
                  libelle="Capacité"
                  idAide="aide-capacite"
                  aide="Une place = un joueur en 1v1, une équipe de cinq en 5v5."
                >
                  <select
                    id="capacite"
                    name="capacite"
                    required
                    defaultValue={capaciteParDefaut}
                    aria-describedby="aide-capacite"
                    className={classeChamp()}
                  >
                    {CAPACITES.map((c) => (
                      <option key={c} value={c}>
                        {c} places
                      </option>
                    ))}
                    {estOrganisateurPremium && (
                      <option value={CAPACITE_ETENDUE}>{CAPACITE_ETENDUE} places — Organisateur</option>
                    )}
                  </select>
                </Champ>
                {estOrganisateurPremium && (
                  <Champ libelle="Nombre de parties par match">
                    <select id="best_of" name="best_of" defaultValue="1" className={classeChamp()}>
                      <option value="1">Best-of-1</option>
                      <option value="3">Best-of-3</option>
                      <option value="5">Best-of-5</option>
                    </select>
                  </Champ>
                )}
              </div>

              {/* Condition de victoire (audit N5), lue dans la donnée Riot de la partie. */}
              <Champ
                libelle="Comment on gagne une partie"
                idAide="aide-condition"
                aide="Dans les deux cas, le vainqueur est lu automatiquement dans la donnée Riot de la partie. En 5v5, la partie se joue toujours jusqu'au Nexus."
              >
                <select
                  id="condition_victoire"
                  name="condition_victoire"
                  defaultValue="nexus"
                  aria-describedby="aide-condition"
                  className={classeChamp()}
                >
                  {CONDITIONS_VICTOIRE.map((c) => (
                    <option key={c.valeur} value={c.valeur}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
            </GroupeFormulaire>

            <GroupeFormulaire numero={numero()} titre="Date et serveur" id="groupe-date">
              <Champ libelle="Région">
                <select id="region" name="region" required defaultValue={regionParDefaut} className={classeChamp()}>
                  <option value="" disabled>
                    Choisis une région
                  </option>
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
                    id="checkin_ouvre_le"
                    name="checkin_ouvre_le"
                    type="datetime-local"
                    required
                    defaultValue={checkin && DATE_SAISIE.test(checkin) ? checkin : undefined}
                    aria-describedby="aide-heures"
                    className={classeChamp()}
                  />
                </Champ>
                <Champ libelle="Début du tournoi">
                  <input
                    id="debute_le"
                    name="debute_le"
                    type="datetime-local"
                    required
                    defaultValue={debut && DATE_SAISIE.test(debut) ? debut : undefined}
                    aria-describedby="aide-heures"
                    className={classeChamp()}
                  />
                </Champ>
              </div>
              <p id="aide-heures" className="-mt-3 text-xs text-muted">
                Heures de Paris. Le check-in ouvre au plus tard au début du tournoi ; les joueurs y confirment leur présence.
              </p>
            </GroupeFormulaire>

            {mesCommunautes.length > 0 && (
              <GroupeFormulaire numero={numero()} titre="Communauté" id="groupe-communaute">
                <Champ
                  libelle="Communauté"
                  idAide="aide-communaute"
                  aide="Le tournoi apparaîtra aussi sur la page de la communauté."
                >
                  <select
                    name="communaute_id"
                    defaultValue={communauteParDefaut}
                    aria-describedby="aide-communaute"
                    className={classeChamp()}
                  >
                    <option value="">Aucune</option>
                    {mesCommunautes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </Champ>
                {/* Tournoi réservé aux membres (04/10/2026) : contrôlé par la base à
                    chaque inscription, figé à la publication. */}
                <Choix
                  type="checkbox"
                  name="reserve_membres"
                  value="oui"
                  titre="Réservé aux membres de la communauté choisie"
                  detail="Pour une école, aux seuls membres à l'adresse d'établissement vérifiée. En 5v5, chacun des cinq joueurs doit en faire partie. Sans communauté choisie, le tournoi reste ouvert à tous."
                />
              </GroupeFormulaire>
            )}

            <GroupeFormulaire numero={numero()} titre="Publication" id="groupe-publication">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 font-texte text-mini font-medium text-muted uppercase">Statut initial</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choix
                    name="statut_initial"
                    value="ouvert"
                    defaultChecked
                    titre="Publier maintenant"
                    detail="Visible et ouvert aux inscriptions."
                  />
                  <Choix
                    name="statut_initial"
                    value="brouillon"
                    titre="Garder en brouillon"
                    detail="Invisible pour les autres joueurs."
                  />
                </div>
              </fieldset>

              {/* Tournoi classé (audit N12) : mêmes critères que la base, lib/tournoi-classe.ts. */}
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-normal text-text-2">
                  Ton tournoi comptera au classement s&apos;il est publié au moins {PREAVIS_TOURNOI_CLASSE_HEURES} h avant
                  son début, si au moins {JOUEURS_MIN_TOURNOI_CLASSE} joueurs prennent le départ et si tu ne joues pas
                  dedans. Sinon, il se joue normalement, sans points. Un tournoi 5v5 ne compte jamais au classement
                  individuel.{" "}
                  <Link
                    href="/comment-ca-marche#tournois-classes"
                    className="text-text underline underline-offset-3 hover:text-accent"
                  >
                    Pourquoi
                  </Link>
                </p>
                <Choix
                  type="checkbox"
                  name="amical"
                  value="oui"
                  titre="Tournoi amical"
                  detail="Aucun point de classement en jeu, même si les conditions ci-dessus sont remplies."
                />
              </div>
            </GroupeFormulaire>

            <BoutonEnvoi libelleEnCours="Création…" className="self-start">
              Créer le tournoi
            </BoutonEnvoi>
          </form>
        </Apparition>
      </div>
    </main>
  );
}
