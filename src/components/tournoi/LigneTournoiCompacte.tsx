import Link from "next/link";
import { partiesDate, type Statut } from "@/lib/tournois";
import { BadgeEnDirect } from "@/components/design/Badges";
import Icone from "@/components/design/Icone";

// Ligne de tournoi du tableau de bord (/moi, revue visuelle du 05/10/2026) :
// petit bloc de date, nom, détails, état en texte. Même lecture que la
// liste des tournois, en plus dense ; seul « En direct » est en vert.

const ETAT: Record<Exclude<Statut, "en_cours">, { libelle: string; classe: string }> = {
  brouillon: { libelle: "Brouillon — non publié", classe: "text-muted" },
  ouvert: { libelle: "Inscriptions ouvertes", classe: "text-text" },
  checkin: { libelle: "Check-in ouvert", classe: "text-text" },
  termine: { libelle: "Terminé", classe: "text-muted" },
  annule: { libelle: "Annulé", classe: "text-faint" },
};

interface LigneTournoiCompacteProps {
  href: string;
  nom: string;
  debuteLe: string;
  details: string;
  statut: Statut;
}

export default function LigneTournoiCompacte({ href, nom, debuteLe, details, statut }: LigneTournoiCompacteProps) {
  const d = partiesDate(debuteLe);
  return (
    <Link
      href={href}
      className="group grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:grid-cols-[3.25rem_minmax(0,1fr)_auto_1rem]"
    >
      <time dateTime={debuteLe} className="flex flex-col items-center rounded-carte border border-line-strong py-1.5 leading-none">
        <span className="font-titre text-xl font-black tabular-nums">{d.jour}</span>
        <span className="mt-1 font-texte text-[9px] font-medium tracking-[2px] text-muted uppercase">{d.mois.replace(".", "")}</span>
      </time>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-titre text-xl leading-none font-black uppercase group-hover:text-accent">{nom}</span>
        <span className="text-sm text-muted tabular-nums">
          {d.heure} · {details}
        </span>
      </span>
      <span className="col-start-2 sm:col-start-auto">
        {statut === "en_cours" ? (
          <BadgeEnDirect />
        ) : (
          <span className={`font-texte text-mini font-semibold whitespace-nowrap uppercase ${ETAT[statut].classe}`}>
            {ETAT[statut].libelle}
          </span>
        )}
      </span>
      <Icone nom="fleche-droite" taille={16} className="hidden text-muted group-hover:text-text sm:block" />
    </Link>
  );
}
