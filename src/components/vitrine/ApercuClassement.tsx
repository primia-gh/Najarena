import Link from "next/link";
import Tableau from "@/components/design/Tableau";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import { COULEUR_PALIER } from "@/lib/paliers";

// Top 10 de l'accueil (maquette accueil, section 04) : rang, joueur,
// palier, rating. Les colonnes « rôle » et « tendance » de la maquette
// n'existent pas dans les données (pas de rôle par match, pas de tendance
// calculée) — remplacées par le palier, qui lui est réel (CLAUDE.md §4).
// Le n°1 est mis en valeur (rang vert, dégradé sur la ligne).

export interface LigneClassement {
  pseudo: string;
  slug: string | null;
  avatarUrl: string | null;
  palier: string | null;
  rating: number;
}

export default function ApercuClassement({ lignes, legende }: { lignes: LigneClassement[]; legende: string }) {
  return (
    <Tableau legende={legende}>
      <thead>
        <tr>
          <th scope="col" className="w-20 pl-4">
            Rang
          </th>
          <th scope="col">Joueur</th>
          <th scope="col">Palier</th>
          <th scope="col" className="text-right">
            Rating
          </th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => {
          const premier = i === 0;
          return (
            <tr
              key={l.slug ?? `${l.pseudo}-${i}`}
              className={premier ? "bg-[linear-gradient(90deg,rgba(182,255,59,.10),rgba(182,255,59,0)_70%)]" : ""}
            >
              <td className={`pl-4 font-titre text-2xl font-extrabold tabular-nums ${premier ? "text-accent" : ""}`}>
                {String(i + 1).padStart(2, "0")}
              </td>
              <td>
                {l.slug ? (
                  <Link
                    href={`/joueur/${l.slug}`}
                    className="inline-flex min-h-11 items-center gap-3.5 font-semibold tracking-[1px] transition-colors duration-200 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <AvatarJoueur pseudo={l.pseudo} src={l.avatarUrl} />
                    {l.pseudo}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-3.5 font-semibold tracking-[1px]">
                    <AvatarJoueur pseudo={l.pseudo} src={l.avatarUrl} />
                    {l.pseudo}
                  </span>
                )}
              </td>
              <td className="text-muted">
                {l.palier ? (
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ background: COULEUR_PALIER[l.palier.toLowerCase()] ?? "var(--color-muted)" }}
                    />
                    {l.palier}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="text-right font-semibold tabular-nums">{l.rating}</td>
            </tr>
          );
        })}
      </tbody>
    </Tableau>
  );
}
