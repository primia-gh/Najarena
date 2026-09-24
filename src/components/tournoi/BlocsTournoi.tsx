import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import Panneau from "@/components/design/Panneau";
import BoutonLien from "@/components/design/BoutonLien";
import Icone from "@/components/design/Icone";
import { LABEL_STATUT, type StatutPublic } from "@/lib/tournois";

// Blocs communs à la page tournoi et au tournoi d'exemple (maquette
// tournoi.dc.html) : en-tête d'affiche, légende du bracket,
// déroulement, essentiel du règlement. Aucune donnée chargée ici : chaque
// page passe ce qu'elle affiche.

/** Statut public : « En cours » plein vert, inscriptions / check-in en contour vert. */
export function StatutTournoi({ statut }: { statut: StatutPublic }) {
  if (statut === "en_cours") {
    return (
      <span className="inline-flex items-center gap-2 rounded-bouton bg-accent px-2.5 py-1.5 text-on-accent">
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulsation rounded-full bg-on-accent" />
        {LABEL_STATUT[statut]}
      </span>
    );
  }
  const style =
    statut === "ouvert" || statut === "checkin"
      ? "border-accent/50 text-accent"
      : statut === "annule"
        ? "border-danger/50 text-danger"
        : "border-line-strong text-muted";
  return <span className={`rounded-bouton border px-2.5 py-[5px] ${style}`}>{LABEL_STATUT[statut]}</span>;
}

export interface InfoTournoi {
  libelle: string;
  valeur: string;
  grand: boolean;
  accent: boolean;
}

interface EnTeteTournoiProps {
  nom: string;
  /** Statut, format… — ligne au-dessus du nom. */
  etiquettes: ReactNode;
  /** Date, région, organisateur — ligne sous le nom. */
  details: ReactNode;
  infos: InfoTournoi[];
  /** Messages et bouton d'action en bas de l'encart. */
  action?: ReactNode;
}

/** En-tête d'affiche : nom géant (dernier mot en vert), logo incliné, encart d'infos. */
export function EnTeteTournoi({ nom, etiquettes, details, infos, action }: EnTeteTournoiProps) {
  const mots = nom.trim().split(/\s+/);
  const debut = mots.length > 1 ? mots.slice(0, -1).join(" ") : "";
  const fin = mots[mots.length - 1];

  return (
    <section className="relative isolate overflow-hidden px-gouttiere pt-32 pb-14 lg:flex lg:min-h-[480px] lg:items-end">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_30%,#171B16_0%,#0B0C0B_55%,#080908_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -top-[380px] -right-36 -z-10 aspect-square w-[900px] rounded-full bg-[radial-gradient(circle,rgba(182,255,59,.16)_0%,rgba(182,255,59,0)_62%)]"
      />
      <Image
        src="/brand/najarena-logo-blanc.svg"
        alt=""
        width={564}
        height={760}
        unoptimized
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 right-[12%] -z-10 h-[760px] w-auto max-w-none rotate-[-10deg] opacity-[0.09]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[200px] bg-[linear-gradient(180deg,rgba(8,9,8,0),#080908)]"
      />

      <div className="mx-auto flex w-full max-w-contenu flex-col gap-10 lg:flex-row lg:items-end lg:gap-[60px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
          <Link
            href="/lol/tournois"
            className="inline-flex min-h-11 items-center self-start text-xs tracking-[3px] text-muted uppercase transition-colors duration-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ← Tous les tournois
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-mini font-semibold uppercase">{etiquettes}</div>
          <h1 className="font-titre text-[clamp(3.5rem,10.4vw,9.375rem)] leading-[0.82] font-black uppercase [overflow-wrap:anywhere]">
            {debut && <>{debut} </>}
            <span className="text-accent">{fin}</span>
          </h1>
          <p className="text-[17px] text-text-2">{details}</p>
        </div>

        <Panneau className="flex w-full shrink-0 flex-col gap-[22px] bg-[rgba(13,15,13,.85)]! p-7 lg:w-[380px]">
          <dl className="grid grid-cols-2 gap-5">
            {infos.map((info) => (
              <div key={info.libelle} className="flex flex-col gap-1.5">
                <dt className="text-mini text-muted uppercase">{info.libelle}</dt>
                <dd
                  className={
                    info.grand
                      ? `font-titre text-[clamp(1.5rem,2.1vw,1.875rem)] leading-none font-black uppercase tabular-nums ${info.accent ? "text-accent" : ""}`
                      : "text-[15px] font-semibold"
                  }
                >
                  {info.valeur}
                </dd>
              </div>
            ))}
          </dl>
          {action}
        </Panneau>
      </div>
    </section>
  );
}

/** Légende des niveaux de preuve, au-dessus du bracket (CLAUDE.md §3). */
export function LegendeBracket({ avecLitige = true }: { avecLitige?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      <li className="inline-flex items-center gap-1.5">
        <Icone nom="coche" taille={12} epaisseur={3} className="text-accent" />
        Vérifié — compte pour le classement
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Icone nom="crayon" taille={12} epaisseur={2.2} />
        Manuel — hors classement, motif affiché
      </li>
      {avecLitige && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger" />
          Litige — en attente de l&apos;organisateur
        </li>
      )}
    </ul>
  );
}

export type EtatEtape = "fait" | "maintenant" | "a_venir";

export function Deroulement({ etapes }: { etapes: { titre: string; quand: string; etat: EtatEtape }[] }) {
  return (
    <Panneau as="section" className="flex flex-col gap-[22px] p-6 sm:p-8">
      <h2 id="deroulement" className="scroll-mt-28 font-texte text-libelle font-medium text-muted uppercase">
        Déroulement
      </h2>
      <ol className="flex flex-col">
        {etapes.map((e) => (
          <li key={e.titre} className="flex items-center gap-[18px] py-2">
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                e.etat === "a_venir" ? "border-[#3A3F3A]" : "border-accent"
              } ${e.etat === "fait" ? "bg-accent" : ""} ${e.etat === "maintenant" ? "animate-pulsation" : ""}`}
            />
            <span className={`flex-1 text-[15px] font-semibold ${e.etat === "a_venir" ? "text-faint" : ""}`}>
              {e.titre}
              {e.etat === "maintenant" && <span className="sr-only"> (en cours)</span>}
            </span>
            <span className="text-[13px] text-muted tabular-nums">{e.quand}</span>
          </li>
        ))}
      </ol>
    </Panneau>
  );
}

/**
 * Règles réellement appliquées par le site (CGU §4 à §6, CLAUDE.md §3-§4),
 * pas celles de la maquette : ni « retard de 15 minutes = forfait », ni
 * « compte lié obligatoire à l'inscription » n'existent.
 */
export function EssentielReglement({ organisateur }: { organisateur?: string | null }) {
  const regles = [
    "Lie ton Riot ID avant de jouer : sans compte lié, ton résultat ne peut pas être retrouvé automatiquement.",
    `Le vainqueur est lu dans l'historique de partie Riot. Sans résultat retrouvé, ${organisateur ?? "l'organisateur"} tranche et affiche son motif — jamais un résultat supposé.`,
    "Check-in obligatoire : sans confirmation de présence, l'organisateur peut t'exclure du bracket.",
    "Un forfait ne rapporte aucun point, à aucun des deux joueurs. Au-delà de 3 victoires contre le même adversaire en 24 h, les suivantes ne comptent pas.",
    "Les règles (capacité, format, dates) sont figées dès la première inscription. Toute tentative de manipulation peut entraîner la suspension du compte.",
  ];
  return (
    <Panneau as="section" className="flex flex-col gap-[22px] p-6 sm:p-8">
      <h2 id="reglement" className="scroll-mt-28 font-texte text-libelle font-medium text-muted uppercase">
        L&apos;essentiel du règlement
      </h2>
      <ol className="flex flex-col gap-3.5">
        {regles.map((r, i) => (
          <li key={r} className="flex gap-3.5 text-[15px] leading-[1.5] text-text-2">
            <span className="font-bold text-accent tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            {r}
          </li>
        ))}
      </ol>
      <BoutonLien href="/comment-ca-marche" variante="secondaire" className="self-start text-[13px]">
        Comment ça marche
      </BoutonLien>
    </Panneau>
  );
}

