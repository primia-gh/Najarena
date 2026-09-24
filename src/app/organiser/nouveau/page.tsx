import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { creerTournoi } from "@/lib/tournoi-actions";
import { REGIONS } from "@/lib/regions";
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
      <div className="relative mx-auto max-w-md px-gouttiere">
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

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Capacité
          </span>
          <select
            id="capacite"
            name="capacite"
            required
            defaultValue="8"
            className="rounded-[3px] border border-line bg-bg px-3 py-2 text-sm text-text"
          >
            {CAPACITES.map((c) => (
              <option key={c} value={c}>
                {c} joueurs
              </option>
            ))}
            {estOrganisateurPremium && (
              <option value={CAPACITE_ETENDUE}>{CAPACITE_ETENDUE} joueurs — Organisateur</option>
            )}
          </select>
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
              className="rounded-[3px] border border-line bg-bg px-3 py-2 text-sm text-text"
            >
              <option value="1">Best-of-1</option>
              <option value="3">Best-of-3</option>
              <option value="5">Best-of-5</option>
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="font-texte text-mini font-medium text-muted uppercase">
            Région
          </span>
          <select
            id="region"
            name="region"
            required
            defaultValue=""
            className="rounded-[3px] border border-line bg-bg px-3 py-2 text-sm text-text"
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
            Ouverture du check-in
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
            Début du tournoi
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

        <Bouton libelleEnCours="Création…" className="mt-2">
          Créer le tournoi
        </Bouton>
      </form>
      </Apparition>
      </div>
    </main>
  );
}
