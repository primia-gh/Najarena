import Link from "next/link";
import { COULEUR_PALIER } from "@/lib/paliers";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import ChiffreRating from "@/components/design/ChiffreRating";
import Tableau from "@/components/design/Tableau";

// Classement de la saison (revue visuelle du 05/10/2026) : podium pour les
// trois premiers, tableau dense ensuite (MASTER §6 : pas de fond, filets
// entre lignes). Chaque chiffre vient de la base : rating et matchs de
// `ratings`, dernière variation du journal public `rating_events`. La
// variation porte toujours son signe (▲ +72 / ▼ −18) : jamais la couleur
// seule.

export interface JoueurClasse {
  rang: number;
  pseudo: string;
  slug: string;
  avatarUrl: string | null;
  rating: number;
  matchs: number;
  palier: string | null;
  /** Dernière variation de points (journal public), arrondie ; null si aucune. */
  variation: number | null;
}

function Palier({ nom }: { nom: string | null }) {
  if (!nom) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: COULEUR_PALIER[nom.toLowerCase()] ?? "var(--color-muted)" }} />
      {nom}
    </span>
  );
}

export function Variation({ valeur }: { valeur: number | null }) {
  if (valeur === null) return <span className="text-faint">—</span>;
  if (valeur === 0) return <span className="text-muted">= 0</span>;
  return valeur > 0 ? (
    <span className="whitespace-nowrap text-accent">
      <span aria-hidden="true">▲ </span>+{valeur}
    </span>
  ) : (
    <span className="whitespace-nowrap text-danger">
      <span aria-hidden="true">▼ </span>−{Math.abs(valeur)}
    </span>
  );
}

export function Podium({ joueurs }: { joueurs: JoueurClasse[] }) {
  return (
    <ol className="grid gap-5 md:grid-cols-3">
      {joueurs.map((j) => {
        const premier = j.rang === 1;
        return (
          <li key={j.slug} className="panneau relative overflow-hidden">
            {premier && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
            {premier && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(182,255,59,.10),rgba(182,255,59,0)_55%)]"
              />
            )}
            <Link
              href={`/joueur/${j.slug}`}
              className="group relative flex h-full flex-col gap-6 p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className={`font-titre text-[3.5rem] leading-[0.8] font-black tabular-nums ${premier ? "text-accent" : "text-faint"}`}
                >
                  <span className="sr-only">Rang </span>
                  {String(j.rang).padStart(2, "0")}
                </span>
                <span className="text-sm text-text-2">
                  <Palier nom={j.palier} />
                </span>
              </div>
              <span className="flex min-w-0 items-center gap-4">
                <AvatarJoueur pseudo={j.pseudo} src={j.avatarUrl} taille={52} />
                <span className="truncate font-titre text-[2rem] leading-none font-black uppercase group-hover:text-accent">
                  {j.pseudo}
                </span>
              </span>
              <span className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-5">
                <span className="flex flex-col gap-2">
                  <span className="font-texte text-mini font-medium text-faint uppercase">Rating</span>
                  <ChiffreRating valeur={j.rating} taille="carte" />
                </span>
                <span className="flex flex-col items-end gap-1.5 text-sm text-muted tabular-nums">
                  <span>{j.matchs} matchs</span>
                  <Variation valeur={j.variation} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function TableauClassement({ joueurs, legende }: { joueurs: JoueurClasse[]; legende: string }) {
  return (
    <Tableau legende={legende}>
      <thead>
        <tr>
          <th scope="col" className="w-20">
            Rang
          </th>
          <th scope="col">Joueur</th>
          <th scope="col" className="hidden sm:table-cell">
            Palier
          </th>
          <th scope="col" className="text-right!">
            Rating
          </th>
          <th scope="col" className="hidden text-right! md:table-cell">
            Matchs
          </th>
          <th scope="col" className="hidden text-right! sm:table-cell">
            Dernière variation
          </th>
        </tr>
      </thead>
      <tbody>
        {joueurs.map((j) => (
          <tr key={j.slug}>
            <td className="font-titre text-2xl font-extrabold text-muted tabular-nums">{String(j.rang).padStart(2, "0")}</td>
            <td>
              <Link
                href={`/joueur/${j.slug}`}
                className="inline-flex min-h-11 items-center gap-3.5 font-semibold tracking-[1px] transition-colors duration-200 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <AvatarJoueur pseudo={j.pseudo} src={j.avatarUrl} />
                {j.pseudo}
              </Link>
            </td>
            <td className="hidden text-sm text-text-2 sm:table-cell">
              <Palier nom={j.palier} />
            </td>
            <td className="text-right font-titre text-2xl font-extrabold tabular-nums">{j.rating}</td>
            <td className="hidden text-right text-sm text-muted tabular-nums md:table-cell">{j.matchs}</td>
            <td className="hidden text-right text-sm tabular-nums sm:table-cell">
              <Variation valeur={j.variation} />
            </td>
          </tr>
        ))}
      </tbody>
    </Tableau>
  );
}

/** Échelle des paliers : seuils fixes (CLAUDE.md §4), couleurs de lib/paliers. */
export function EchellePaliers({ paliers }: { paliers: { nom: string; ratingMin: number }[] }) {
  const tries = [...paliers].sort((a, b) => a.ratingMin - b.ratingMin);
  return (
    <ol className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-6" aria-label="Paliers et seuils de rating">
      {tries.map((p, i) => {
        const suivant = tries[i + 1]?.ratingMin;
        const seuil = i === 0 && suivant !== undefined ? `< ${suivant}` : `${p.ratingMin}${suivant === undefined ? "+" : ""}`;
        const couleur = COULEUR_PALIER[p.nom.toLowerCase()] ?? "var(--color-muted)";
        return (
          <li key={p.nom} className="flex flex-col gap-2">
            <span aria-hidden="true" className="h-1 rounded-full" style={{ background: couleur }} />
            <span className="font-texte text-mini font-semibold text-text uppercase">{p.nom}</span>
            <span className="text-sm text-muted tabular-nums">{seuil}</span>
          </li>
        );
      })}
    </ol>
  );
}
