import Link from "next/link";
import Tableau from "@/components/design/Tableau";
import AvatarJoueur from "@/components/design/AvatarJoueur";
import { COULEUR_PALIER } from "@/lib/paliers";

// Top 10 de l'accueil (maquette accueil, section 04) : rang, joueur,
// palier, rating, tendance. La colonne « rôle » de la maquette est remplacée
// par le palier (le rôle d'un match n'est pas enregistré) ; la tendance est
// réelle : sens de la dernière variation de points (rating_events).
// Toujours 10 lignes : tant que le classement n'est pas rempli, les places
// restantes s'affichent « à prendre » — jamais de section vide sur la
// vitrine (décision du 23/09/2026), jamais de joueur inventé non plus.
// Le n°1 est mis en valeur (rang vert, dégradé sur la ligne).

export type Tendance = "monte" | "baisse" | "stable";

export interface LigneClassement {
  pseudo: string;
  slug: string | null;
  avatarUrl: string | null;
  palier: string | null;
  rating: number;
  tendance: Tendance | null;
}

const AFFICHAGE_TENDANCE: Record<Tendance, { texte: string; couleur: string }> = {
  monte: { texte: "▲ monte", couleur: "text-accent" },
  baisse: { texte: "▼ baisse", couleur: "text-danger" },
  stable: { texte: "— stable", couleur: "text-muted" },
};

const TAILLE_TOP = 10;

interface ApercuClassementProps {
  lignes: LigneClassement[];
  legende: string;
  /** Lien d'appel sur la première place libre (« Joue pour la prendre »). */
  lienPremierePlace?: string;
}

export default function ApercuClassement({ lignes, legende, lienPremierePlace }: ApercuClassementProps) {
  const placesLibres = Math.max(0, TAILLE_TOP - lignes.length);
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
          <th scope="col" className="text-right">
            Tendance
          </th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => {
          const premier = i === 0;
          const tendance = l.tendance ? AFFICHAGE_TENDANCE[l.tendance] : null;
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
              <td className={`text-right text-sm whitespace-nowrap ${tendance?.couleur ?? "text-muted"}`}>
                {tendance?.texte ?? "—"}
              </td>
            </tr>
          );
        })}
        {Array.from({ length: placesLibres }, (_, j) => {
          const rang = lignes.length + j;
          const premier = rang === 0;
          const appel = j === 0 && lienPremierePlace;
          return (
            <tr
              key={`libre-${rang}`}
              className={premier ? "bg-[linear-gradient(90deg,rgba(182,255,59,.10),rgba(182,255,59,0)_70%)]" : ""}
            >
              <td className={`pl-4 font-titre text-2xl font-extrabold tabular-nums ${premier ? "text-accent" : "text-faint"}`}>
                {String(rang + 1).padStart(2, "0")}
              </td>
              <td>
                <span className="inline-flex min-h-11 items-center gap-3.5 tracking-[1px] text-muted">
                  <span
                    aria-hidden="true"
                    className={`h-[34px] w-[34px] shrink-0 rounded-avatar border border-dashed ${
                      premier ? "border-accent" : "border-line-strong"
                    }`}
                  />
                  Place à prendre
                  {appel && (
                    <Link
                      href={lienPremierePlace}
                      className="inline-flex min-h-11 items-center text-xs font-semibold tracking-[2px] whitespace-nowrap text-accent uppercase transition-colors duration-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      Joue pour la prendre<span aria-hidden="true">&nbsp;→</span>
                    </Link>
                  )}
                </span>
              </td>
              <td className="text-faint">—</td>
              <td className="text-right text-faint">—</td>
              <td className="text-right text-faint">—</td>
            </tr>
          );
        })}
      </tbody>
    </Tableau>
  );
}
