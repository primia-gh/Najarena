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
import { classeCarte } from "@/lib/ui";
import Bouton from "@/components/ui/Bouton";
import FondEcailles from "@/components/design/FondEcailles";
import Apparition from "@/components/design/Apparition";

export const metadata: Metadata = {
  title: "Organiser un tournoi — Najarena",
  robots: { index: false, follow: false },
};

const CAPACITES = [4, 8, 16, 32, 64];
const CAPACITE_ETENDUE = 128;

interface OrganiserNouveauPageProps {
  searchParams: Promise<{ erreur?: string }>;
}

export default async function OrganiserNouveauPage({
  searchParams,
}: OrganiserNouveauPageProps) {
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/connexion");
  }

  const { offre } = await chargerOffre(supabase, userData.user.id);
  const estOrganisateurPremium = offre === "organisateur";

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-32 pb-24 font-texte text-text">
      <FondEcailles />
      <div className="relative px-grille *:max-w-xl">
      <Apparition>
      <Link
        href="/moi"
        className="inline-flex min-h-11 items-center font-texte text-xs tracking-[3px] text-muted uppercase hover:text-text"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-titre uppercase text-section font-black tracking-[1px] text-text hyphens-auto [overflow-wrap:anywhere]">
        Organiser un tournoi
      </h1>
      <p className="mt-2 text-sm text-muted">
        League of Legends · 1v1 — seul format disponible pour l&apos;instant. Une fois publié, ton
        tournoi apparaît immédiatement dans la liste et les joueurs peuvent s&apos;inscrire ; en
        brouillon, lui seul reste visible pour toi.
      </p>
      {estOrganisateurPremium && (
        <Link
          href="/lol/recherche"
          className="mt-2 inline-block text-sm text-accent underline underline-offset-3"
        >
          Rechercher des joueurs à recruter
        </Link>
      )}
      </Apparition>

      <Apparition delai={0.1}>
      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-danger"}>{erreur}</p>
      )}

      {Boolean(process.env.ANTHROPIC_API_KEY) && (
        <div className="mt-6">
          <AssistantOrganisateur />
        </div>
      )}

      <form action={creerTournoi} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Nom du tournoi
          </span>
          <input
            id="nom"
            name="nom"
            type="text"
            required
            minLength={3}
            maxLength={60}
            placeholder="Ex. Tournoi du jeudi soir"
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        {/* Format (audit N21) : en 5v5, les capitaines inscrivent leur équipe. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="font-texte text-mini font-medium text-muted uppercase">Format</legend>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="radio" name="format" value="1v1" defaultChecked className="accent-accent" />
            1v1 — chaque joueur s&apos;inscrit lui-même
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="radio" name="format" value="5v5" className="accent-accent" />
            5v5 — le capitaine inscrit son équipe de cinq (hors classement individuel)
          </label>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Capacité
          </span>
          <select
            id="capacite"
            name="capacite"
            required
            defaultValue="8"
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <span className="text-xs text-muted">Une place = un joueur en 1v1, une équipe de cinq en 5v5.</span>
        </label>

        {estOrganisateurPremium && (
          <label className="flex flex-col gap-1">
            <span className="font-texte text-mini font-medium text-muted uppercase">
              Format (Best-of)
            </span>
            <select
              id="best_of"
              name="best_of"
              defaultValue="1"
              className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option value="1">Best-of-1</option>
              <option value="3">Best-of-3</option>
              <option value="5">Best-of-5</option>
            </select>
          </label>
        )}

        {/* Condition de victoire (audit N5), lue dans la donnée Riot de la partie. */}
        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Comment on gagne une partie
          </span>
          <select
            id="condition_victoire"
            name="condition_victoire"
            defaultValue="nexus"
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {CONDITIONS_VICTOIRE.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.libelle}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">
            Dans les deux cas, le vainqueur est lu automatiquement dans la donnée Riot de la partie. En 5v5, la
            partie se joue toujours jusqu&apos;au Nexus.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Région
          </span>
          <select
            id="region"
            name="region"
            required
            defaultValue=""
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="" disabled>
              Choisis une région
            </option>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Ouverture du check-in (heure de Paris)
          </span>
          <input
            id="checkin_ouvre_le"
            name="checkin_ouvre_le"
            type="datetime-local"
            required
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Début du tournoi (heure de Paris)
          </span>
          <input
            id="debute_le"
            name="debute_le"
            type="datetime-local"
            required
            className="min-h-11 rounded-bouton border border-line-strong bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-texte text-mini font-medium text-muted uppercase">
            Statut initial
          </legend>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name="statut_initial"
              value="ouvert"
              defaultChecked
              className="accent-accent"
            />
            Publier immédiatement (visible et ouvert aux inscriptions)
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="radio" name="statut_initial" value="brouillon" className="accent-accent" />
            Garder en brouillon (non visible publiquement)
          </label>
        </fieldset>

        {/* Tournoi classé (audit N12) : mêmes critères que la base, lib/tournoi-classe.ts. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="font-texte text-mini font-medium text-muted uppercase">Classement</legend>
          <p className="text-sm leading-normal text-muted">
            Ton tournoi comptera au classement s&apos;il est publié au moins {PREAVIS_TOURNOI_CLASSE_HEURES} h avant
            son début, si au moins {JOUEURS_MIN_TOURNOI_CLASSE} joueurs prennent le départ et si tu ne joues pas
            dedans. Sinon, il se joue normalement, sans points. Un tournoi 5v5 ne compte jamais au classement
            individuel.{" "}
            <Link href="/comment-ca-marche#tournois-classes" className="text-text underline underline-offset-3">
              Pourquoi
            </Link>
          </p>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" name="amical" value="oui" className="accent-accent" />
            Tournoi amical : aucun point de classement en jeu
          </label>
        </fieldset>

        <Bouton libelleEnCours="Création…" className="mt-2">
          Créer le tournoi
        </Bouton>
      </form>
      </Apparition>
      </div>
    </main>
  );
}
