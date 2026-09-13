import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { creerTournoi } from "@/lib/tournoi-actions";
import { REGIONS } from "@/lib/regions";
import { AssistantOrganisateur } from "@/components/AssistantOrganisateur";
import { classeCarte, classeBoutonPrimaire } from "@/lib/ui";
import FondArene from "@/components/accueil/FondArene";
import Reveal from "@/components/accueil/Reveal";

export const metadata: Metadata = {
  title: "Organiser un tournoi — Najarena",
  robots: { index: false, follow: false },
};

const CAPACITES = [4, 8, 16, 32, 64];

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

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-16">
      <FondArene />
      <div className="relative mx-auto max-w-md px-6">
      <Reveal>
      <Link
        href="/moi"
        className="font-mono text-[0.66rem] tracking-[0.18em] text-ardoise uppercase hover:text-encre"
      >
        ← Mon compte
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-encre">
        Organiser un tournoi
      </h1>
      <p className="mt-2 text-sm text-ardoise">
        League of Legends · 1v1 — seul format disponible pour l&apos;instant. Une fois publié, ton
        tournoi apparaît immédiatement dans la liste et les joueurs peuvent s&apos;inscrire ; en
        brouillon, lui seul reste visible pour toi.
      </p>
      </Reveal>

      <Reveal delai={0.1}>
      {erreur && (
        <p className={"mt-6 " + classeCarte("sceau") + " text-sm text-sceau-texte"}>{erreur}</p>
      )}

      {Boolean(process.env.ANTHROPIC_API_KEY) && (
        <div className="mt-6">
          <AssistantOrganisateur />
        </div>
      )}

      <form action={creerTournoi} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
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
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Capacité
          </span>
          <select
            id="capacite"
            name="capacite"
            required
            defaultValue="8"
            className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre"
          >
            {CAPACITES.map((c) => (
              <option key={c} value={c}>
                {c} joueurs
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Région
          </span>
          <select
            id="region"
            name="region"
            required
            defaultValue=""
            className="rounded-[3px] border border-trait bg-papier px-3 py-2 text-sm text-encre"
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
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Ouverture du check-in
          </span>
          <input
            id="checkin_ouvre_le"
            name="checkin_ouvre_le"
            type="datetime-local"
            required
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Début du tournoi
          </span>
          <input
            id="debute_le"
            name="debute_le"
            type="datetime-local"
            required
            className="rounded-[3px] border border-trait bg-carte px-3 py-2 text-sm text-encre outline-none focus:border-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sceau"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-mono text-[0.62rem] tracking-[0.14em] text-ardoise uppercase">
            Statut initial
          </legend>
          <label className="flex items-center gap-2 text-sm text-encre">
            <input
              type="radio"
              name="statut_initial"
              value="ouvert"
              defaultChecked
              className="accent-sceau"
            />
            Publier immédiatement (visible et ouvert aux inscriptions)
          </label>
          <label className="flex items-center gap-2 text-sm text-encre">
            <input type="radio" name="statut_initial" value="brouillon" className="accent-sceau" />
            Garder en brouillon (non visible publiquement)
          </label>
        </fieldset>

        <button type="submit" className={"mt-2 " + classeBoutonPrimaire()}>
          Créer le tournoi
        </button>
      </form>
      </Reveal>
      </div>
    </main>
  );
}
