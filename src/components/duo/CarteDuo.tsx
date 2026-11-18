import Link from "next/link";
import type { ReactNode } from "react";
import { COULEUR_PALIER } from "@/lib/paliers";
import { LABEL_ROLE, type Role } from "@/lib/roles";
import { LABEL_CRENEAU, LABEL_OBJECTIF, type CreneauDuo, type ObjectifDuo } from "@/lib/duo";
import AvatarJoueur from "@/components/design/AvatarJoueur";

// Carte d'une annonce « cherche un duo » (18/11/2026) : poste et postes
// cherchés, rating officiel s'il est classé, créneaux, objectif, puis
// l'annonce telle que le joueur l'a écrite. Sous une proposition, les
// raisons de l'appariement (lib/duo.ts) : ce qui le fonde, rien d'autre.

interface CarteDuoProps {
  pseudo: string;
  slug: string;
  avatarUrl: string | null;
  poste: Role;
  postesCherches: Role[];
  rating: number | null;
  palier: string | null;
  creneaux: CreneauDuo[];
  /** Créneaux partagés avec le joueur qui regarde, mis en avant. */
  creneauxCommuns?: CreneauDuo[];
  objectif: ObjectifDuo;
  message: string | null;
  raisons?: string[];
  /** Bouton ou état de la demande. */
  children?: ReactNode;
}

export default function CarteDuo({
  pseudo,
  slug,
  avatarUrl,
  poste,
  postesCherches,
  rating,
  palier,
  creneaux,
  creneauxCommuns = [],
  objectif,
  message,
  raisons = [],
  children,
}: CarteDuoProps) {
  return (
    <article className="panneau flex h-full flex-col gap-5 p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <span className="flex min-w-0 items-center gap-3.5">
          <AvatarJoueur pseudo={pseudo} src={avatarUrl} taille={44} />
          <span className="flex min-w-0 flex-col gap-1">
            <Link
              href={`/joueur/${slug}`}
              className="truncate font-titre text-2xl leading-none font-black uppercase hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {pseudo}
            </Link>
            <span className="text-sm text-muted">
              <span className="text-text-2">{LABEL_ROLE[poste]}</span> · cherche{" "}
              {postesCherches.map((p) => LABEL_ROLE[p]).join(", ")}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          {rating !== null ? (
            <>
              <span className="font-titre text-3xl leading-none font-black tabular-nums">{rating}</span>
              {palier && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: COULEUR_PALIER[palier.toLowerCase()] ?? "var(--color-muted)" }}
                  />
                  {palier}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs tracking-[2px] text-faint uppercase">Non classé</span>
          )}
        </span>
      </header>

      <ul aria-label="Créneaux" className="flex flex-wrap gap-1.5">
        {creneaux.map((c) => {
          const commun = creneauxCommuns.includes(c);
          return (
            <li
              key={c}
              className={`rounded-bouton border px-2 py-1 text-xs ${commun ? "border-text text-text" : "border-line-strong text-muted"}`}
            >
              {LABEL_CRENEAU[c]}
              {commun && <span className="sr-only"> (en commun)</span>}
            </li>
          );
        })}
      </ul>

      {message && <p className="text-text-2 [overflow-wrap:anywhere]">« {message} »</p>}

      {raisons.length > 0 && (
        <ul aria-label="Pourquoi ce joueur" className="flex flex-col gap-1 text-sm text-text-2">
          {raisons.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden="true" className="text-faint">
                —
              </span>
              {r}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <span className="text-xs text-muted">
          Objectif : <span className="text-text">{LABEL_OBJECTIF[objectif]}</span>
        </span>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </footer>
    </article>
  );
}
