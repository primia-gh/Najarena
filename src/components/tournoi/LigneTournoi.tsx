import Link from "next/link";
import type { ReactNode } from "react";
import { partiesDate, type TournoiListe } from "@/lib/tournois";
import { BadgeEnDirect } from "@/components/design/Badges";
import Icone from "@/components/design/Icone";

// Ligne de la liste des tournois (revue visuelle du 05/10/2026). Avant :
// un nom et une ligne de texte gris, le statut en badge vert répété sur
// chaque carte. Désormais : bloc de date lisible d'un coup d'œil, nom,
// format, places prises, et un seul signal fort — « En direct » (MASTER
// §6). Toute la ligne est cliquable ; aucune information n'est portée par
// la couleur seule.

export type { TournoiListe };


function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-bouton border border-line-strong px-1.5 py-0.5 font-texte text-[10px] font-semibold tracking-[2px] whitespace-nowrap text-text-2 uppercase">
      {children}
    </span>
  );
}

function Etat({ t }: { t: TournoiListe }) {
  switch (t.statut) {
    case "en_cours":
      return <BadgeEnDirect />;
    case "checkin":
      return (
        <span className="inline-flex items-center gap-1.5 font-texte text-mini font-semibold whitespace-nowrap text-text uppercase">
          <Icone nom="horloge" taille={13} />
          Check-in ouvert
        </span>
      );
    case "ouvert":
      return (
        <span className="font-texte text-mini font-semibold whitespace-nowrap text-text uppercase">
          {t.inscrits >= t.capacite
            ? "Complet"
            : `${t.capacite - t.inscrits} place${t.capacite - t.inscrits > 1 ? "s" : ""} libre${t.capacite - t.inscrits > 1 ? "s" : ""}`}
        </span>
      );
    case "termine":
      return <span className="font-texte text-mini font-medium whitespace-nowrap text-muted uppercase">Terminé</span>;
    case "annule":
      return <span className="font-texte text-mini font-medium whitespace-nowrap text-faint uppercase">Annulé</span>;
  }
}

export default function LigneTournoi({ t }: { t: TournoiListe }) {
  const d = partiesDate(t.debute_le);
  const passe = t.statut === "termine" || t.statut === "annule";
  const unite = t.format === "5v5" ? "équipes" : "joueurs";
  const remplissage = Math.min(100, Math.round((t.inscrits / t.capacite) * 100));

  return (
    <Link
      href={`/lol/tournois/${t.slug}`}
      className={`group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-3 border-b border-line py-5 transition-colors duration-200 hover:bg-[rgba(245,245,244,0.02)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:grid-cols-[4.5rem_minmax(0,1fr)_11rem_12rem_1.25rem] md:gap-x-8 ${
        passe ? "opacity-80" : ""
      }`}
    >
      <time dateTime={t.debute_le} className="flex flex-col items-center rounded-carte border border-line-strong py-2 leading-none">
        <span className="font-texte text-[10px] font-medium tracking-[2px] text-muted uppercase">{d.jourSemaine.replace(".", "")}</span>
        <span className="mt-1 font-titre text-[2rem] font-black tabular-nums">{d.jour}</span>
        <span className="mt-1 font-texte text-[10px] font-medium tracking-[2px] text-muted uppercase">{d.mois.replace(".", "")}</span>
      </time>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="font-titre text-[1.625rem] leading-[0.95] font-black uppercase [overflow-wrap:anywhere] group-hover:text-accent">
          {t.nom}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted tabular-nums">
          <span>{d.heure}</span>
          <span aria-hidden="true">·</span>
          <span>{t.format}</span>
          <span aria-hidden="true">·</span>
          <span>{t.region}</span>
          {t.officiel && <Etiquette>Officiel</Etiquette>}
          {t.amical && <Etiquette>Amical</Etiquette>}
          {t.statut === "termine" && t.classe === true && <Etiquette>Classé</Etiquette>}
          {t.reserve_membres && <Etiquette>Membres</Etiquette>}
          {t.reserve_non_classes && <Etiquette>Non classés</Etiquette>}
        </span>
      </div>

      <div className="col-start-2 flex flex-col gap-2 md:col-start-auto">
        <span className="text-sm text-text-2 tabular-nums">
          <span className="font-semibold text-text">{t.inscrits}</span>/{t.capacite} {unite}
        </span>
        {!passe && (
          <span className="block h-1 w-full max-w-44 overflow-hidden rounded-full bg-line-strong" aria-hidden="true">
            <span className="block h-full rounded-full bg-text-2" style={{ width: `${remplissage}%` }} />
          </span>
        )}
      </div>

      <div className="col-start-2 md:col-start-auto">
        <Etat t={t} />
      </div>

      <Icone
        nom="fleche-droite"
        taille={18}
        className="hidden text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-text md:block"
      />
    </Link>
  );
}
