import Link from "next/link";
import type { ReactNode } from "react";
import { COULEUR_OFFRE, LABEL_OFFRE, type Offre } from "@/lib/offres";
import { COULEUR_PALIER } from "@/lib/paliers";
import { formaterDate } from "@/lib/tournois";
import AvatarJoueur from "@/components/design/AvatarJoueur";

// Carte d'un joueur qui cherche une équipe (revue visuelle du 05/10/2026) :
// ce qu'un capitaine regarde d'abord — poste, région, palier et rating
// officiel s'il est classé — puis l'annonce, telle que le joueur l'a écrite.
// Le poste vient du compte Riot principal (renseigné par le joueur), le
// rating de `ratings` : rien n'est déduit ici.

interface CarteJoueurDisponibleProps {
  pseudo: string;
  slug: string | null;
  avatarUrl: string | null;
  role: string | null;
  region: string | null;
  rating: number | null;
  palier: string | null;
  offre: Exclude<Offre, "gratuit"> | null;
  message: string | null;
  objectif: string | null;
  publieLe: string;
  /** Boutons « Inviter dans… » du capitaine. */
  children?: ReactNode;
}

export default function CarteJoueurDisponible({
  pseudo,
  slug,
  avatarUrl,
  role,
  region,
  rating,
  palier,
  offre,
  message,
  objectif,
  publieLe,
  children,
}: CarteJoueurDisponibleProps) {
  const actions = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <article className="panneau flex h-full flex-col gap-5 p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <span className="flex min-w-0 items-center gap-3.5">
          <AvatarJoueur pseudo={pseudo} src={avatarUrl} taille={44} />
          <span className="flex min-w-0 flex-col gap-1">
            {slug ? (
              <Link
                href={`/joueur/${slug}`}
                className="truncate font-titre text-2xl leading-none font-black uppercase hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {pseudo}
              </Link>
            ) : (
              <span className="truncate font-titre text-2xl leading-none font-black uppercase">{pseudo}</span>
            )}
            <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
              {role && <span className="text-text-2">{role}</span>}
              {role && region && <span aria-hidden="true">·</span>}
              {region && <span>{region}</span>}
              {offre && (
                <span
                  className="ml-1 rounded-bouton border border-line-strong px-1.5 py-px font-texte text-[10px] font-semibold tracking-[2px] uppercase"
                  style={{ color: COULEUR_OFFRE[offre] }}
                >
                  {LABEL_OFFRE[offre]}
                </span>
              )}
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

      {message && <p className="text-text-2 [overflow-wrap:anywhere]">« {message} »</p>}

      <footer className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted tabular-nums">
          <span>{objectif ? <>Objectif : <span className="text-text">{objectif}</span></> : "Cherche une équipe régulière"}</span>
          <span>Publiée le {formaterDate(publieLe).split(" ")[0]}</span>
        </span>
        {actions && <div className="flex flex-wrap gap-2">{children}</div>}
      </footer>
    </article>
  );
}
